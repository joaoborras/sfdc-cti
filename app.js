//**************** NewRelic monitoring ***********************
//require('newrelic');

//*********************** variables and objects used in the proxy ******************
//no final, o object credentials sera um array porque vai ter varias ZD's apps conectando no proxy
var credentials = [{
	username: '',
	password: '',
	appId: '',//for SFDC, appId is the "res" object
	callhalf: '',
	subscriptionId: '',
}];

//this array stores all the BW groups from all clients. A subscription must be opened for each one
var BW_groups = ['PBXL_Test',];
var shuttingdown = false;

//this object stores data related to BW for each ZD's app. These data are unique to the application
//as there is only one channel and subscription, that will receive all events from BW related to 
//all opened calls
var bwconnection = {
	applicationId: 'local',
	channelSetId: 'local_channelset',
	channelId: '',
	heartbeatIntervalId: '',
	channelUpdateIntervalId: '',
	subscriptionId: '',
	subscriptionUpdateIntervalId: '',
	callhalf: '',
	groupadmin: 'provtestpbxl@pbxl',
	groupadminpassword: '6a8prG28tv!',
	serviceprovider: 'PBXL%20Inc.',
};

//**************** global constants to be used by all ZD's apps *********************
var HEARTBEAT_INTERVAL = 15000;
var CHANNEL_UPDATE_INTERVAL = 1800000;
var SUBSCRIPTION_UPDATE_INTERVAL = 1600000;
var BW_URL = 'xsp1.pbxl.net';
var XSPPORT = 80;
var SUBSCRIPTION_CLOSE = '</Subscription>';
var EVENT_CLOSE = '</xsi:Event>';
var CHANNEL_CLOSE = '</Channel>';
var HEARTBEAT_CLOSE = '<ChannelHeartBeat xmlns="http://schema.broadsoft.com/xsi"/>';

//****************** required objects and libs ***********************
var express = require('express');
var http = require('http'); //http object used to connect the proxy with BW server
var path = require('path');
var app = express();
var parseString = require('xml2js').parseString;
var DOMParser = require('xmldom').DOMParser;
var fs = require('fs');
var winston = require('winston');
winston.emitErrs = true;
var log = new winston.Logger({
    transports: [
        new winston.transports.File({
            //level: 'info',
            filename: '/tmp/logs/all-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 100000,
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

//******************* setup the proxy ***********************
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

app.use(express.static(path.join(__dirname, 'public')));
var oneDay = 86400000;
//app.use(express.static(__dirname + '/public', { maxAge: oneDay }));

app.use(app.router);

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

//******************* commands from client(ZD app or test web page) ************************
//TODO: the Access-Control is not working -> have to check it
app.all('*', function(req, res, next){
  	//res.header("Access-Control-Allow-Origin", "https://pbxltest.zendesk.com");
  	res.header("Access-Control-Allow-Origin", "https://ap.salesforce.com");
  	res.header("Access-Control-Allow-Origin", "*");
  	res.header("Access-Control-Allow-Headers", "X-Requested-With, Access-Control-Allow-Credentials, Authorization");
  	res.header("Access-Control-Allow-Credentials", true);
  	next();
 });

app.all('/', function(req, res, next){
  	////console.log("/ received " + req.query);
  	log.info('<- / received ');
	res.send('public/pbxlSoftPhone.html');
 });

app.all('/callevent', function(req, res, next){
  	////console.log("/ received " + req.query);
  	log.info('<- /callevent received ');
  	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
 });

app.all('/getuser_info/', function(req, res){
  	////console.log("/getuser_info/ received " + req.query);
  	log.info('<- /getuser_info/');
	getName(res);
 });

app.all('/get_directoryforuser/', function(req, res){
  	////console.log("/get_directoryforuser/ received " + req.query);
  	log.info('<- /get_directoryforuser/ from: ' + req.param('username'));
	getDirectoryForUser(res, req.param('username'));
 });

app.all('/get_callhistoryforuser/', function(req, res){
  	////console.log("/get_callhistoryforuser/ received " + req.query);
  	log.info('<- /get_callhistoryforuser/ from: ' + req.param('username'));
	getCallHistoryForUser(res, req.param('username'), req.param('calllogtype'));
 });

app.all('/heartbeat/', function(req, res){
	var username = req.param('username');
	////console.log("<- /heartbeat/ received from " + username);
	log.info("<- /heartbeat/ received from " + username);
	for(var x in credentials){
		if(credentials[x].username == username){
			var responseobj = credentials[x].appId;
			var heartbeatresponse = '<Event>';
			heartbeatresponse += '<eventtype>HeartBeatResponse</eventtype>';
			heartbeatresponse += '</Event>';
			responseobj.write(heartbeatresponse, 'utf8');
		}
	}
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
 });

app.all("/log_in/", function(req, res){
	//console.log("/log_in/ received " + req.query);
	////console.log('Logging In: username: ' + req.param('username'));
	log.info("Logging In: username: " + req.param('username') + 
		     " / password: " + req.param('password') + '\r\n');
	res.set('Content-Type', 'text/plain');
	verifyUser(req.param('username'), req.param('password'), function(result){
		if( result == true){
			var hasuser = false;
			for(var x in credentials){
				if(credentials[x].username == req.param('username')){
					hasuser = true;
					break;
				}
			}
			if(!hasuser){
				//console.log('user still not in credentials. Will add it...');
				credentials.push({
					username: req.param('username'),
					password: req.param('password'),
					appId: '',
					callhalf: '',
				});
			}
			//console.log('Logged in users: ' + '\r\n');
			for(var x in credentials){
				//console.log('Username: ' + credentials[x].username + '\r\n');
			}
			res.status(200);
			res.send("Login successfull!");
		}else{
			res.status(404);
			res.send();
		}
	})
});

app.all("/log_out/", function(req, res){
	//console.log("/log_out/ called from user " + req.param('username'));
	log.info('<- /log_out/ called from user ' + req.param('username'));
	for(var index in credentials){
		if(credentials[index].username === req.param('username')){
			//console.log("found user " + req.param('username') + " in credentials and will now delete it");
			res.status(200);
			var responseobj = credentials[index].appId;
			var logoutresponse = '<Event>';
			logoutresponse += '<eventtype>LogOutResponse</eventtype>';
			logoutresponse += '</Event>';
			responseobj.write(logoutresponse);
			credentials.splice(index, 1);
			break;
		}else{
			res.status(404);
		}
	}
	//console.log('Logged in users: ' + '\r\n');
	for(var x in credentials){
		//console.log('Username: ' + credentials[x].username + '\r\n');
	}
	res.send();
});

app.all("/connect/", function(req, res){
	var username = req.param('username');
	//console.log("<- /connect/ called from user " + username);
	log.info('<- /connect/ called from user ' + username);
	for(var index in credentials){
		if(credentials[index].username == username){
			//channel events subscription
			eventSubscription('Advanced Call', username, credentials[index].password);
			//console.log("found user " + username + " in credentials and will now connect it");
			credentials[index].appId = res;
			var connectresponse = '<Event>';
			connectresponse += '<eventtype>ConnectResponse</eventtype>';
			connectresponse += '</Event>';
			//console.log("-> ConnectResponse to SFDC(" + username + ")");
			log.info("-> ConnectResponse to SFDC(" + username + ")");
			res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
			res.setHeader('Transfer-Encoding', 'chunked');
			res.write(connectresponse, 'utf8');
		}else{
			//console.log("Username " + username + " not in credentials");
		}
	}
});

app.all("/issignedin/", function(req, res){
	log.info('<- /issignedin/ from ' + req.param('username'));
	for(var index in credentials){
		if(credentials[index].username === req.param('username')){
			res.status(200);
		}else{
			res.status(400);
		}
	}
	res.send();
});

app.all("/make_call/", function(req, res){
	//console.log("/make_call/ received " + req.query);
	log.info('<- /make_call/ from: ' + req.param('username') + 'to: ' + req.param('destination'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	makeCall(req.param('destination'),req.param('username'));
});

app.all('/accept_call', function(req, res){
	//console.log("<- /accept_call/ received" + req.query);
	log.info('<- /accept_call/ from: ' + req.param('username'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	acceptCall(req.param('username'));
});

app.all('/disconnect_call/', function(req, res){
	//console.log("<- /disconnect_call/ received" + req.query);
	log.info('<- /disconnect_call/ from: ' + req.param('username'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	disconnectCall(req.param('username'), req.param('callid'));
});

app.all('/decline_call/', function(req, res){
	//console.log("<- /decline_call/ received" + req.query);
	log.info("<- /decline_call/ received" + req.query);
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	declineCall(req.param('username'), req.param('callid'));
});

app.all('/transfer_call/', function(req, res){
	//console.log("/transfer_call/ received" + req.query);
	log.info('<- /transfer_call/ from: ' + req.param('username') + ' to: ' + req.param('destination'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	transferCall(req.param('username'), req.param('destination')); //TODO: implement rejectCall();
});

app.all('/consult_transfer_call/', function(req, res){
	//console.log("/consult_transfer_call/ received" + req.query);
	log.info('<- /consult_transfer_call/ from: ' + req.param('username') + ' to: ' + req.param('destination'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	consultTransferCall(req.param('username'), req.param('callid1'), req.param('callid2')); //TODO: implement rejectCall();
});

app.all('/hold_call/', function(req, res){
	//console.log("/hold_call/ received" + req.query);
	log.info('<- /hold_call/ from: ' + req.param('username'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	holdCall(req.param('username'), req.param('callid')); //TODO: implement rejectCall();
});

app.all('/retrieve_call/', function(req, res){
	//console.log("/retrieve_call/ received" + req.query);
	log.info('<- /retrieve_call/ from: ' + req.param('username'));
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.send();
	retrieveCall(req.param('username'), req.param('callid')); //TODO: implement rejectCall();
});



//********************** event processing work functions *************************
verifyUser = function(username, password, callback){
	//console.log("INFO: verifyUser -> " + username);
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/profile",
	  method: 'GET',
	  auth: username + ':' + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  res.setEncoding('utf8');
	  var resbody = "";
	  if(res.statusCode === 200){
	  	//console.log("User found");
	  	callback(true);
	  }else{
	  	//console.log("User not found");
	  	log.error("<- response from BW for verifyUser: " + res.statusCode + '\r\n');
	  	callback(false);
	  }
	});

	req.on('error', function(e) {
  		log.info('problem with request: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> GET ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/profile \r\n");
};

getDirectoryForUser = function(response, username){
	var password;
	for(var x in credentials){
		if(credentials[x].username == username){
			password = credentials[x].password;
			break;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/directories/Group",
	  method: 'GET',
	  auth: username + ':' + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW for getDirectoryUser: " + res.statusCode + '\r\n');
		}
	  res.setEncoding('utf8');
	  var resbody = "";
	  res.on('data', function(chunk){
	  	resbody += chunk;
	  	if(resbody.indexOf('</Group>') >= 0){
	  		response.send(resbody);
	  		resbody = "";
	  	}
	  });
	});

	req.on('error', function(e) {
  		log.info('problem with request: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> GET ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/directories/Group \r\n");
};

getCallHistoryForUser = function(response, username, calllogtype){
	var password;
	for(var x in credentials){
		if(credentials[x].username == username){
			password = credentials[x].password;
			break;
		}
	}
	var options = {
	  host: BW_URL,
      	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/directories/" + calllogtype,
	  method: 'GET',
	  auth: username + ':' + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW for getCallHistoryForUser: " + res.statusCode + '\r\n');
		}
	  res.setEncoding('utf8');
	  var resbody = "";
	  res.on('data', function(chunk){
	  	resbody += chunk;
	  	if(resbody.indexOf('</'+ calllogtype + '>') >= 0){
	  		response.send(resbody);
	  		resbody = "";
	  	}
	  });
	});

	req.on('error', function(e) {
  		log.info('problem with request: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> GET ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/directories/" + calllogtype + "\r\n");
}

requestChannel = function(){
	//console.log("-> INFO: requestChannel");
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.async/com.broadsoft.xsi-events/v2.0/channel",
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		//auth: 'BWS_Test.zentestuser2@pbxl.net:t1Ew694c2x',
		headers: {'Content-Type': 'text/xml'}
	};
	var req = http.request(options, function(res){//daqui
		switch(res.statusCode){
			case 200:
				res.setEncoding('utf8');
				var resbody = "";
				res.on('data', function (chunk) {
					log.info("<- " + chunk + '\r\n');
		        	resbody += chunk;
		        	if(resbody.indexOf(EVENT_CLOSE) >= 0 || resbody.indexOf(CHANNEL_CLOSE) >= 0 || 
		        		resbody.indexOf(HEARTBEAT_CLOSE) >= 0 || resbody.indexOf(SUBSCRIPTION_CLOSE) >= 0){
						parseChunk(resbody);
						resbody = ""; //prepares to receive a new event, if any!
					}else if(resbody.indexOf('<ChannelHeartBeat ') >= 0){
						//do nothing here as it is only answer from the heartbeat command
					}
		    	});
				res.on('error', function(e){
					//console.log("Error on requestChannel. Status is " + e.status);
					//console.log("Error message: " + e.message);
					//console.log("Will try again...");
					requestChannel();
				});
				res.on('close', function(e){
					//console.log("ERROR: Main connection closed.");
					log.error("Main connection closed.");
				});
				break;
			case 401:
				log.info("RequestChannel Response: " + res.statusCode);
			case 403:
			case 404:
				deleteChannel(function(){
					//console.log("Channel deleted!");
				});
				break;
			default:
				//console.log("Error in requestChannel. Response status is " + res.statusCode);
				log.error("<- response from BW: " + res.statusCode + '\r\n');
				//console.log("Will try again in 5 secs...");
				log.info("Will try again in 5 secs...");
				setTimeout(function(){
					requestChannel();
				},5000);
		}


/*
		if(res.statusCode != 200 && res.statusCode != 401 && res.statusCode != 403){//not auth problem
			//console.log("Error in requestChannel. Response status is " + res.statusCode);
			log.error("<- response from BW: " + res.statusCode + '\r\n');
			//console.log("Will try again in 5 secs...");
			log.info("Will try again in 5 secs...");
			setTimeout(function(){
				requestChannel();
			},5000);
		}else{
			res.setEncoding('utf8');
			var resbody = "";
			res.on('data', function (chunk) {
				log.info("<- " + chunk + '\r\n');
	        	resbody += chunk;
	        	if(resbody.indexOf(EVENT_CLOSE) >= 0 || resbody.indexOf(CHANNEL_CLOSE) >= 0 || 
	        		resbody.indexOf(HEARTBEAT_CLOSE) >= 0 || resbody.indexOf(SUBSCRIPTION_CLOSE) >= 0){
					parseChunk(resbody);
					resbody = ""; //prepares to receive a new event, if any!
				}else if(resbody.indexOf('<ChannelHeartBeat ') >= 0){
					//do nothing here as it is only answer from the heartbeat command
				}
	    	});
			res.on('error', function(e){
				//console.log("Error on requestChannel. Status is " + e.status);
				//console.log("Error message: " + e.message);
				//console.log("Will try again...");
				requestChannel();
			});
			res.on('close', function(e){
				//console.log("ERROR: Main connection closed.");
				log.error("Main connection closed.");
			});
		}*/
	}); //aqui

	req.on('error', function(e) {
  		//console.log('problem with requestChannel request: ' + e.message);
	});
	//console.log("channelSetId in requestChannel function is " + bwconnection.channelSetId);
	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
		xml_data = xml_data + '<Channel xmlns="http://schema.broadsoft.com/xsi">';
		xml_data = xml_data + '<channelSetId>' + bwconnection.channelSetId + '</channelSetId>';
		xml_data = xml_data + '<priority>1</priority>';
		xml_data = xml_data + '<weight>100</weight>';
		xml_data = xml_data + '<expires>3600</expires>';
		xml_data = xml_data + '<applicationId>' + bwconnection.applicationId + '</applicationId>';
		xml_data = xml_data + '</Channel>';

	req.write(xml_data);
	req.end();
	log.info('-> POST ' + BW_URL + '/com.broadsoft.async/com.broadsoft.xsi-events/v2.0/channel \r\n' + xml_data + '\r\n');
};

updateChannel = function(){
	//console.log("-> INFO: updateChannel ID " + bwconnection.channelId);
	log.info("-> updateChannel ID " + bwconnection.channelId);
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/channel/" + bwconnection.channelId,
		method: 'PUT',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			//console.log("Error in updateChannel. Response status is " + res.statusCode);
			log.error("<- response from BW: " + res.statusCode + '\r\n');
			if(res.statusCode == 403){
				deleteSubscription(function(statuscode){
					requestChannel();
				});
			}
		}
	});
	req.on('error', function(e) {
  		//console.log('problem with updateChannel request: ' + e.message);
	});
	//console.log("channelSetId in requestChannel function is " + bwconnection.channelSetId);
	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
		xml_data = xml_data + '<Channel xmlns="http://schema.broadsoft.com/xsi">';
		xml_data = xml_data + '<expires>3800</expires>';
		xml_data = xml_data + '</Channel>';

	req.write(xml_data);
	req.end();
	log.info('-> PUT ' + BW_URL + '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + '\r\n' + xml_data + '\r\n');
};

deleteChannel = function(callback){
	//console.log("-> INFO: deleteChannel ID " + bwconnection.channelId);
	log.info("-> deleteChannel ID " + bwconnection.channelId);
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/channel/" + bwconnection.channelId,
		method: 'DELETE',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		callback(res.statusCode);
	});
	req.on('error', function(e) {
  		//console.log('problem with deleteChannel request: ' + e.message);
	});

	req.end();
	log.info('-> DELETE ' + BW_URL + '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + '\r\n');
};

startHeartbeat = function(){
	if(bwconnection.channelId != ''){
		//console.log("-> INFO: startHeartbeat");
		var options = {
		  host: BW_URL,
		  port: XSPPORT,
		  path: '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + "/heartbeat",
		  method: 'PUT',
		  auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		};
		var http = require('http');
		var req = http.request(options, function(res) {
			if(res.statusCode != 200){//some problems happened with the channel. Open a new one
				log.error("<- response from BW on heartbeat: " + res.statusCode + '\r\n');
				//requestChannel();
			}
		  	log.info("<- response from BW on heartbeat: " + res.statusCode + '\r\n');
		});

		req.on('error', function(e) {
	  		//console.log('problem with heartbeat request: ' + e.message);
		});

		req.end();
		log.info('-> PUT ' + BW_URL + '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + "/heartbeat \r\n");
	}else{
		//console.log("WARNING: no heartbeat sent to BW as there is no channel openned");
		//log.warning("WARNING: no heartbeat sent to BW as there is no channel openned");
		log.warn("WARNING: no heartbeat sent to BW as there is no channel openned");
	}
};

//need to make a subscription for each user registered
eventSubscription = function(event, username, password){
	//console.log("-> INFO: eventSubscription");
	console.log('username: ' + username + ' and password: ' + password);
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/user/" + username,
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			//console.log("ERROR: <- Subscription response from BW: " + res.statusCode);
			log.error("<- Subscription response from BW: " + res.statusCode);
		}else{
			res.setEncoding('utf8');
			res.on('data', function(response){
				//console.log("<- Subscription Response: " + response + '\r\n');
				log.info("<- Subscription Response: " + response + '\r\n');
				var xmldoc = new DOMParser().parseFromString(response,'text/xml');
				for(var index in credentials){
					if(credentials[index].username === username){
						credentials[index].subscriptionId = xmldoc.getElementsByTagName('subscriptionId').item(0).firstChild.nodeValue;
					}
				}
				bwconnection.subscriptionId = xmldoc.getElementsByTagName('subscriptionId').item(0).firstChild.nodeValue;	
				bwconnection.subscriptionUpdateIntervalId = setInterval(updateSubscription, SUBSCRIPTION_UPDATE_INTERVAL);
			})
		}
	});

	req.on('error', function(e) {
  		//console.log('problem with request: ' + e.message);
	});

	//console.log("channelSEtId in eventSubscription function is " + bwconnection.channelSetId);
	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
	xml_data = xml_data + '<Subscription xmlns=\"http://schema.broadsoft.com/xsi\">';
	xml_data = xml_data + "<event>" + event + "</event>";
	xml_data = xml_data + "<expires>3600</expires>";
	xml_data = xml_data + "<channelSetId>" + bwconnection.channelSetId + "</channelSetId>";
	xml_data = xml_data + '<applicationId>' + bwconnection.applicationId + '</applicationId>';
	xml_data = xml_data + "</Subscription>";

	req.write(xml_data);
	req.end();
	log.info('-> POST ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/user/" + username + '\r\n' + xml_data + '\r\n');
};

updateSubscription = function(){
	//console.log("-> INFO: updateSubscription ID " + bwconnection.subscriptionId);
	log.info("-> updateSubscription ID " + bwconnection.subscriptionId);

	for(var index in credentials){
		var username = credentials[index].username == username;
		var password = credentials[index].username == password;
		var options = {
			host: BW_URL,
			port: XSPPORT,
			path: "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId ,
			method: 'PUT',
			auth: username + ':' + password,
			headers: {'Content-Type': 'text/xml'}
		};
		var http = require('http');
		var req = http.request(options, function(res){
			if(res.statusCode != 200){
				//console.log("<- Subscription Update response from BW: " + res.statusCode);
				log.error("<- Subscription Update response from BW: " + res.statusCode);
				if(res.statusCode == 403){
					eventSubscription('Advanced Call');
				}
			}
		});

		req.on('error', function(e) {
	  		//console.log('problem with request: ' + e.message);
		});

		var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
		xml_data = xml_data + '<Subscription xmlns=\"http://schema.broadsoft.com/xsi\">';
		xml_data = xml_data + "<expires>3800</expires>";
		xml_data = xml_data + "</Subscription>";

		req.write(xml_data);
		req.end();
		log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId + '\r\n' + xml_data + '\r\n');

	}

	/*var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId ,
		method: 'PUT',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			//console.log("<- Subscription Update response from BW: " + res.statusCode);
			log.error("<- Subscription Update response from BW: " + res.statusCode);
			if(res.statusCode == 403){
				eventSubscription('Advanced Call');
			}
		}
	});

	req.on('error', function(e) {
  		//console.log('problem with request: ' + e.message);
	});

	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
	xml_data = xml_data + '<Subscription xmlns=\"http://schema.broadsoft.com/xsi\">';
	xml_data = xml_data + "<expires>3800</expires>";
	xml_data = xml_data + "</Subscription>";

	req.write(xml_data);
	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId + '\r\n' + xml_data + '\r\n');*/
};

deleteSubscription = function(callback){
	//console.log("-> INFO: deleteSubscription ID " + bwconnection.subscriptionId);
	log.info("-> deleteSubscription ID " + bwconnection.subscriptionId);
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId ,
		method: 'DELETE',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		//console.log('deleteSubscription answer: ' + res.statusCode);
		callback(res.statusCode);
	});

	req.on('error', function(e) {
  		//console.log('problem with request: ' + e.message);
	});

	req.end();
	log.info('-> DELETE ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/subscription/" + bwconnection.subscriptionId + '\r\n');
};

sendResponseEvent = function(eventId){
	//console.log("-> INFO: sendResponseEvent");
	var options = {
		host: BW_URL,
		port: XSPPORT,
		path: "/com.broadsoft.xsi-events/v2.0/channel/eventresponse",
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			//console.log("<- response from BW: " + res.statusCode);
			log.error("<- response from BW: " + res.statusCode);
		}
	});

	req.on('error', function(e) {
  		//console.log('problem with sendResponseEvent request: ' + e.message);
	});

	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
		xml_data = xml_data + "<EventResponse xmlns=\"http://schema.broadsoft.com/xsi\">";
		xml_data = xml_data + "<eventID>" + eventId + "</eventID>";
		xml_data = xml_data + "<statusCode>200</statusCode>";
		xml_data = xml_data + "<reason>OK</reason>";
		xml_data = xml_data + "</EventResponse>";

	req.write(xml_data);
	req.end();

	log.info('-> POST ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/channel/eventresponse \r\n" + xml_data + '\r\n');
};

parseChunk = function(chunk){ //chunk is already string
	//now, look for what kind of event we received
	if(chunk.indexOf('<Channel ') >= 0){ //<Channel event
		parseString(chunk, function(err, result){
			bwconnection.channelId = result.Channel.channelId;
			//start heartbeat
			bwconnection.heartbeatIntervalId = setInterval(startHeartbeat, HEARTBEAT_INTERVAL);
			//startHeartbeat();
			//channel events subscription
			//eventSubscription('Advanced Call');
			//set interval for channel update
			bwconnection.channelUpdateIntervalId = setInterval(updateChannel, CHANNEL_UPDATE_INTERVAL);
		});
	}else if(chunk.indexOf('<ChannelHeartBeat ') >= 0){
		//TODO: for now do nothing as it is only answer from heartbeat
	}else if(chunk.indexOf('ChannelTerminatedEvent') >= 0){
		//console.log("WARNING: ChannelTerminatedEvent <-");
		//log.warning("ChannelTerminatedEvent <-");
		log.warn("ChannelTerminatedEvent <-");
		if(shuttingdown){
			exitServer();
		}else{
			bwconnection.channelId = '';
			requestChannel();
		}
	}else if(chunk.indexOf('SubscriptionTerminatedEvent') >= 0){//will open a new subscription
		//console.log('WARNING: SubscriptionTerminatedEvent <-');
		//log.warning('SubscriptionTerminatedEvent <-');
		log.warn('SubscriptionTerminatedEvent <-');
		if(shuttingdown){
			deleteChannel(function(){
				//console.log('delete channel callback');
			});
		}else{
			bwconnection.subscriptionId = '';
		}
		//eventSubscription('Advanced Call');
	}else if(chunk.indexOf('<xsi:Event ') >= 0){//xsi:Event received. Now see if it is channel disconnection
		//for every xsi:Event, needs to send event Response
		var remoteparty = 'no_number';
		try{
			var xmldoc = new DOMParser().parseFromString(chunk,'text/xml');	
			var eventid = xmldoc.getElementsByTagName('xsi:eventID').item(0).firstChild.nodeValue;
			sendResponseEvent(eventid);
			var userid = xmldoc.getElementsByTagName('xsi:userId').item(0).firstChild.nodeValue;
			var targetid = xmldoc.getElementsByTagName('xsi:targetId').item(0).firstChild.nodeValue;
			//var remoteparty = xmldoc.getElementsByTagName('xsi:address').item(0).firstChild.nodeValue.substring(5);
			try{
				remoteparty = xmldoc.getElementsByTagName('xsi:address').item(0).firstChild.nodeValue.substring(5);
			}catch(error){
				//log.warning('there is no xsi:address element');
				log.warn('there is no xsi:address element');
				//console.log('there is no xsi:address element');
			}
			var eventType = xmldoc.getElementsByTagName('xsi:eventData').item(0).getAttribute('xsi1:type').trim();
			eventType = eventType.substring(4);//string off the prefix "xsi:" from the eventType
		}catch(error){
			//TODO: for now, do nothing as it means that some event does not contains the 
			//searched node
		}
		switch(eventType){
			case 'CallReceivedEvent':
				try{
					var calltype = xmldoc.getElementsByTagName('xsi:callType').item(0).firstChild.nodeValue;
					if(calltype == 'Group'){
						remoteparty = xmldoc.getElementsByTagName('xsi:name').item(0).firstChild.nodeValue;
					}else if(calltype == 'Network'){
						var countrycode = xmldoc.getElementsByTagName('xsi:address').item(0).getAttribute('countryCode');
						if(remoteparty.indexOf(countrycode) >= 0){
							remoteparty = remoteparty.replace(countrycode, '0');
						}
					}
				}catch(error){
					//TODO: for now, do nothing as it means that some event does not contains the 
					//searched node
				}
				log.info("<- INFO: CallReceivedEvent(from: " + remoteparty + " to: " + targetid + ")");
				//console.log("<- INFO: CallReceivedEvent(from: " + remoteparty + " to: " + targetid + ")");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var callid = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
						credentials[index].callhalf =  callid;
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallReceivedEvent</eventtype>';
						incomingcallXml += '<callerid>' + remoteparty + '</callerid>';
						incomingcallXml += '<callid>' + callid + '</callid>';
						incomingcallXml += '</Event>';
						try{
							responseobj.write(incomingcallXml);
							//console.log("INFO: CallReceivedEvent -> SFDC");
							log.info("CallReceivedEvent -> SFDC(" + targetid + ")");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallReceivedEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallReceivedEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallOriginatedEvent':
				log.info("<- INFO: CallOriginatedEvent");
				//console.log("<- INFO: CallOriginatedEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var callid = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
						credentials[index].callhalf = callid; 
						var responseobj = credentials[index].appId;
						var outgoingcallXml = '<Event>';
						outgoingcallXml += '<eventtype>CallOriginatedEvent</eventtype>';
						outgoingcallXml += '<callingid>' + remoteparty + '</callingid>';
						outgoingcallXml += '<callid>' + callid + '</callid>';
						outgoingcallXml += '</Event>';
						try{
							responseobj.write(outgoingcallXml);
							log.info("CallOriginatedEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallOriginatedEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallOriginatedEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallOriginatedEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallAnsweredEvent':
				//console.log("<- INFO: CallAnsweredEvent");
				var countrycode;
				try{
					countrycode = xmldoc.getElementsByTagName('xsi:address').item(0).getAttribute('countryCode');
				}catch(error){
					//TODO: for now, do nothing as it means that some event does not contains the 
					//searched node
				}
				if(remoteparty.indexOf(countrycode) >= 0){
					remoteparty = remoteparty.replace(countrycode, '0');
				}
				for(var index in credentials){
					if(credentials[index].username === targetid){
						//credentials[index].callhalf = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
						var responseobj = credentials[index].appId;
						var answeredcallXml = '<Event>';
						answeredcallXml += '<eventtype>CallAnsweredEvent</eventtype>';
						answeredcallXml += '<callerid>' + remoteparty + '</callerid>';
						answeredcallXml += '</Event>';
						try{
							responseobj.write(answeredcallXml);
							log.info("CallAnsweredEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallAnsweredEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallAnsweredEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallAnsweredEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallReleasedEvent':
				//console.log("<- INFO: CallReleasedEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var callid = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
						var responseobj = credentials[index].appId;
						var callreleasedXml = '<Event>';
						callreleasedXml += '<eventtype>CallReleasedEvent</eventtype>';
						callreleasedXml += '<callid>' + callid + '</callid>';
						callreleasedXml += '</Event>';
						try{
							responseobj.write(callreleasedXml);
							log.info("CallReleasedEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallReleasedEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallReleasedEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallReleasedEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallHeldEvent':
				//console.log("<- INFO: CallHeldEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var callheldXml = '<Event>';
						callheldXml += '<eventtype>CallHeldEvent</eventtype>';
						callheldXml += '</Event>';
						try{
							responseobj.write(callheldXml);
							log.info("CallHeldEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallHeldEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallHeldEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallHeldEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallRedirectedEvent':
				//console.log('<- INFO: CallRedirectedEvent');
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var callredirectedXml = '<Event>';
						callredirectedXml += '<eventtype>CallRedirectedEvent</eventtype>';
						callredirectedXml += '</Event>';
						try{
							responseobj.write(callredirectedXml);
							log.info("CallRedirectedEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallRedirectedEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallRedirectedEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallRedirectedEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallRetrievedEvent':
				//console.log('<- INFO: CallRetrievedEvent');
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var callretrievedXml = '<Event>';
						callretrievedXml += '<eventtype>CallRetrievedEvent</eventtype>';
						callretrievedXml += '</Event>';
						try{
							responseobj.write(callretrievedXml);
							log.info("CallRetrievedEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallRetrievedEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallRetrievedEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallRetrievedEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallUpdatedEvent':
				//console.log("<- INFO: CallUpdatedEvent");
				var callid = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
				var personality = xmldoc.getElementsByTagName('xsi:personality').item(0).firstChild.nodeValue;
				if(personality == 'Click-to-Dial'){
					var callupdatedXml = '<Event>';
					callupdatedXml += '<eventtype>CallUpdatedEvent</eventtype>';
					//console.log("personality is Click-to-Dial");
					try{
						if(xmldoc.getElementsByTagName('xsi:allowAnswer')){
							//console.log('supports allowanser');
							callupdatedXml += '<allowAnswer/>';
						}
					}catch(error){
						//console.log('does not support allowanser');
					}
					callupdatedXml += '</Event>';
					for(var index in credentials){
						if(credentials[index].username == targetid){
							var responseobj = credentials[index].appId;
							credentials[index].callhalf = callid;
							responseobj.write(callupdatedXml);
						}
					}			
				}
				break;
			case 'CallTransferredEvent':
				//console.log('<- INFO: CallTransferredEvent');
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var calltransferreddXml = '<Event>';
						calltransferreddXml += '<eventtype>CallTransferredEvent</eventtype>';
						calltransferreddXml += '</Event>';
						try{
							responseobj.write(calltransferreddXml);
							log.info("CallTransferredEvent -> SFDC(" + targetid + ")");
							//console.log("INFO: CallTransferredEvent -> SFDC");
						}catch(error)
						{
							//console.log("ERROR: Cannot send CallTransferredEvent -> SFDC(no http session)");
							log.info("ERROR: Cannot send CallTransferredEvent -> SFDC(no http session)");
						}
						break;
					}
				}
				break;
			case 'CallSubscriptionEvent':
				//console.log("<- INFO: CallSubscriptionEvent");
				break;
			case 'DoNotDisturbEvent':
			case 'CallForwardingAlwaysEvent':
			case 'RemoteOfficeEvent':
				break;
			default:
		}
	}
};

//******************************** XSI actions processing work functions ***************************
acceptCall = function(username){
	//console.log("acceptCall and username is " + username);
	var callhalf;
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			callhalf = credentials[i].callhalf;
			password = credentials[i].password;
		}
	}
	//console.log("-> INFO: acceptCall");
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "/talk",
	  method: 'PUT',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.error('problem with talk PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "/talk \r\n");
};

makeCall = function(destination, username){
	//console.log("-> INFO: makeCall to destination " + destination + " and username " + username);
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/new?address=" + encodeURIComponent(destination) + "&location=all",
	  method: 'POST',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	});

	req.on('error', function(e) {
  		log.error('problem with talk PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> POST ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/new?address=" + encodeURIComponent(destination) +  + "&location=all" + '\r\n');
};

disconnectCall = function(username, callid){
	//console.log("-> disconnectCall: " + callid);
	var callhalf;
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			callhalf = credentials[i].callhalf;
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid,
	  method: 'DELETE',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with talk DELETE: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> DELETE ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + '\r\n');
};

transferCall = function(username, destination){
	//console.log("-> transferCall");
	var callhalf;
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			callhalf = credentials[i].callhalf;
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "/BlindTransfer?address=" + destination,
	  method: 'PUT',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with BlindTransfer PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "BlindTransfer&=" + destination + '\r\n');
};

consultTransferCall = function(username, callid1, callid2){
	//console.log("-> consultTransferCall");
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid1 + "/ConsultTransfer/" + callid2,
	  method: 'PUT',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with ConsultTransfer PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid1 + "/ConsultTransfer/" + callid2 + '\r\n');
};

declineCall = function(username, callid){
	//console.log("-> declineCall");
	//console.log("username is: " + username);
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/?decline=true",
	  method: 'DELETE',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with talk DELETE: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> DELETE ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/?decline=true" + '\r\n');
};

holdCall = function(username, callid){
	//console.log("-> HoldCall");
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/Hold",
	  method: 'PUT',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with call Hold PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/Hold" + '\r\n');
};

retrieveCall = function(username, callid){
	//console.log("-> ReconnectCall");
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  port: XSPPORT,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/Reconnect",
	  method: 'PUT',
	  auth: username + ":" + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  if(res.statusCode != 200){
			log.error("<- response from BW: " + res.statusCode + '\r\n');
		}
	});

	req.on('error', function(e) {
  		log.info('problem with call Reconnect PUT: ' + e.message + '\r\n');
	});

	req.end();
	log.info('-> PUT ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callid + "/Reconnect" + '\r\n');
};

//**************** listen for incoming events ***********************
var opts = {key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem')};

/*http.createServer(app).listen(app.get('port'), function() {
	//console.log('Express server listening on port ' + app.get('port'));
});*/

//var opts = {key: fs.readFileSync('server.key'), cert: fs.readFileSync('server.crt')};
mainhttps = require('https'); //the https object to connect the client with the proxy
mainhttps.createServer(opts, app).listen(app.get('port'), function(){
	//console.log('Express HTTPS server listening on port ' + app.get('port'));
});
//**************** start the server by registering a channel in BW ************
requestChannel();

//************************* gracefull shutdown ********************************
process.on( 'SIGINT', function() {
	//console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  	//close the main http connection for all users
  	for(var i = 0; i<credentials.length; i++){
  		if(credentials[i].username != '' )
  		{
  			var responseobj = credentials[i].appId;
	  		var disconnectionevent = '<Event>';
			disconnectionevent += '<eventtype>DisconnectionEvent</eventtype>';
			disconnectionevent += '</Event>';
			try{
				responseobj.write(disconnectionevent);
			}catch(error){
				//console.log('no objectresponse to send data too...');
				continue;
			}
  		}
  	}
  	//delete all signed in subscribers
  	credentials.splice(0, credentials.length);

  	//clear timers for heartbeat, channel and subscription update
  	clearInterval(bwconnection.channelUpdateIntervalId);
  	clearInterval(bwconnection.subscriptionUpdateIntervalId);
  	clearInterval(bwconnection.heartbeatIntervalId);

  	shuttingdown = true;
  	//delete all subscriptions
  	deleteSubscription(function(statuscode){
  		////console.log('subscription delete callback');
  		/*if(statuscode == 403 && shuttingdown){
  			exitServer();
  		}*/
	//exitServer();
  	});
  	exitServer();
  //release all ongoing calls (???)
});

exitServer = function(){//this function is called upon the reception of ChannelTerminatedEvent
	//http.close();
	process.exit();
};
