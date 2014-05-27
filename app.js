//*********************** variables and objects used in the proxy ******************
//no final, o object credentials sera um array porque vai ter varias ZD's apps conectando no proxy
var credentials = [{
	username: '',
	password: '',
	appId: '',//for SFDC, appId is the "res" object
	callhalf: '',
	zddomain: '',
}];

//this array stores all the BW groups from all clients. A subscription must be opened for each one
var BW_groups = ['PBXL_Test',];

//this object stores data related to BW for each ZD's app. These data are unique to the application
//as there is only one channel and subscription, that will receive all events from BW related to 
//all opened calls
var bwconnection = {
	applicationId: 'broadsoft4sfdc',
	channelSetId: 'broadsoft4sfdcchannelset',
	channelId: '',
	heartbeatIntervalId: '', //TODO: this variable is global as there is only 1 streaming http
	subscriptionId: '',
	callhalf: '',
	groupadmin: 'jp_zentest@pbxl.net',
	groupadminpassword: 'Borras123',
	serviceprovider: 'PBXL%20Inc.',
	groupId: 'PBXL_Test',
};

//**************** global constants to be used by all ZD's apps *********************
var HEARTBEAT_INTERVAL = 15000;
var BW_URL = 'xsp1.pbxl.net';
var ZD_URL = 'pbxltest.zendesk.com';
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
var Log = require('log');
var log = new Log('debug', fs.createWriteStream('log.txt', {'flags':'a'}));

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

app.use(app.router);

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

//******************* commands from client(ZD app or test web page) ************************
//TODO: the Access-Control is not working -> have to check it
app.all('*', function(req, res, next){
  	//res.header("Access-Control-Allow-Origin", "https://pbxltest.zendesk.com");
  	res.header("Access-Control-Allow-Origin", "*");
  	res.header("Access-Control-Allow-Headers", "X-Requested-With, Access-Control-Allow-Credentials, Authorization");
  	res.header("Access-Control-Allow-Credentials", true);
  	next();
 });

app.all('/', function(req, res, next){
  	console.log("/ received " + req.query);
	res.send('public/pbxlSoftPhone.html');
 });

app.all('/getuser_info/', function(req, res){
  	console.log("/getuser_info/ received " + req.query);
	getName(res);
 });

app.all('/get_directoryforuser/', function(req, res){
  	console.log("/get_directoryforuser/ received " + req.query);
	getDirectoryForUser(res, req.param('username'));
 });

app.all('/heartbeat/', function(req, res){
  	console.log("/heartbeat/ received " + req.query);
	res.writeHead(200, {'Content-Type': 'text/plain'});
  	res.end();
 });

app.all("/log_in/", function(req, res){
	console.log("/log_in/ received " + req.query);
	console.log('Logging In: username: ' + req.param('username'));
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
				console.log('user still not in credentials. Will add it...');
				credentials.push({
					username: req.param('username'),
					password: req.param('password'),
					appId: '',
					callhalf: '',
					zddomain: '',
				});
			}
			console.log('Logged in users: ' + '\r\n');
			for(var x in credentials){
				console.log('Username: ' + credentials[x].username + '\r\n');
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
	console.log("/log_out/ called from user " + req.param('username'));
	for(var index in credentials){
		if(credentials[index].username === req.param('username')){
			console.log("found user " + req.param('username') + " in credentials and will now delete it");
			credentials.splice(index, 1);
			break;
		}
	}
	console.log('Logged in users: ' + '\r\n');
	for(var x in credentials){
		console.log('Username: ' + credentials[x].username + '\r\n');
	}
	res.status(200);
	res.send();
});

app.all("/connect/", function(req, res){
	console.log("/connect/ called from user " + req.param('username'));
	for(var index in credentials){
		if(credentials[index].username === req.param('username')){
			console.log("found user " + req.param('username') + " in credentials and will now connect it");
			credentials[index].appId = res;
		}else{
			console.log("Username " + req.param('username') + " not in credentials");
		}
	}
});

app.all("/issignedin/", function(req, res){
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
	console.log("/make_call/ received " + req.query);
	makeCall(req.param('destination'),req.param('username'));
});

app.all('/accept_call', function(req, res){
	console.log("/accept_call/ received" + req.query);
	acceptCall(req.param('username'));
});

app.all('/disconnect_call/', function(req, res){
	console.log("/disconnect_call/ received" + req.query);
	disconnectCall(req.param('username'));
});

app.all('/decline_call/', function(req, res){
	console.log("/decline_call/ received" + req.query);
	declineCall(req.param('username'));
});

app.all('/transfer_call/', function(req, res){
	console.log("/transfer_call/ received" + req.query);
	transferCall(req.param('username'), req.param('destination')); //TODO: implement rejectCall();
});

//********************** event processing work functions *************************
verifyUser = function(username, password, callback){
	console.log("INFO: verifyUser -> " + username);
	var options = {
	  host: BW_URL,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/profile",
	  method: 'GET',
	  auth: username + ':' + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
	  res.setEncoding('utf8');
	  var resbody = "";
	  if(res.statusCode === 200){
	  	console.log("User found");
	  	callback(true);
	  }else{
	  	console.log("User not found");
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
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/directories/Group",
	  method: 'GET',
	  auth: username + ':' + password
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW for verifyUser: " + res.statusCode + '\r\n');
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

//TODO: probably, will have to open one channel for each user...
//if so, the function must receive the username and password.
requestChannel = function(){
	console.log("-> INFO: requestChannel");
	var options = {
		host: BW_URL,
		path: "/com.broadsoft.async/com.broadsoft.xsi-events/v2.0/channel",
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			console.log("Error in requestChannel. Response status is " + res.statusCode);
			console.log("Will try again...");
			log.error("<- response from BW: " + res.statusCode + '\r\n');
			log.info("Will try again...");
			requestChannel();
		}
		res.setEncoding('utf8');
		var resbody = "";
		res.on('data', function (chunk) {
			log.info("<- " + chunk + '\r\n');
        	resbody += chunk;
        	if(resbody.indexOf(EVENT_CLOSE) >= 0 || resbody.indexOf(CHANNEL_CLOSE) >= 0 || resbody.indexOf(HEARTBEAT_CLOSE) >= 0){
				parseChunk(resbody);
				resbody = ""; //prepares to receive a new event, if any!
			}else if(resbody.indexOf('<ChannelHeartBeat ') >= 0){
				//do nothing here as it is only answer from the heartbeat command
			}
    	});
		res.on('error', function(e){
			console.log("Error on requestChannel. Status is " + e.status);
			console.log("Error message: " + e.message);
			console.log("Will try again...");
			requestChannel();
		});
	});

	req.on('error', function(e) {
  		console.log('problem with requestChannel request: ' + e.message);
	});
	console.log("channelSetId in requestChannel function is " + bwconnection.channelSetId);
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

startHeartbeat = function(){
	console.log("-> INFO: startHeartbeat");
	var options = {
	  host: BW_URL,
	  path: '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + "/heartbeat",
	  method: 'PUT',
	  auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
	};
	var http = require('http');
	var req = http.request(options, function(res) {
		if(res.statusCode != 200){
			log.error("<- response from BW on heartbeat: " + res.statusCode + '\r\n');
		}
	  	log.info("<- response from BW on heartbeat: " + res.statusCode + '\r\n');
	});

	req.on('error', function(e) {
  		console.log('problem with heartbeat request: ' + e.message);
	});

	req.end();
	log.info('-> PUT ' + BW_URL + '/com.broadsoft.xsi-events/v2.0/channel/' + bwconnection.channelId + "/heartbeat \r\n");

	heartbeatIntervalId = setTimeout(function(){
		if(bwconnection.channelId != ''){
			startHeartbeat();
		}else{
			//if there is no channel, then start again from requesting a new one
			requestChannel();
		}
	}, HEARTBEAT_INTERVAL);
};

//need to make a subscription for each user registered
eventSubscription = function(event){
	console.log("-> INFO: eventSubscription");
	var options = {
		host: BW_URL,
		path: "/com.broadsoft.xsi-events/v2.0/serviceprovider/" + bwconnection.serviceprovider + 
			  "/group/" + bwconnection.groupId,
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			console.log("<- Subscription response from BW: " + res.statusCode);
			log.error("<- Subscription response from BW: " + res.statusCode);
		}
		res.setEncoding('utf8');
		var resbody = "";
		res.on('data', function (chunk) {
			log.info('<- ' + chunk + '\r\n');
    	});
		res.on('end',function(){
			//TODO
		});

	});

	req.on('error', function(e) {
  		console.log('problem with request: ' + e.message);
	});

	console.log("channelSEtId in eventSubscription function is " + bwconnection.channelSetId);
	var xml_data = '<?xml version="1.0" encoding="UTF-8"?>';
	xml_data = xml_data + '<Subscription xmlns=\"http://schema.broadsoft.com/xsi\">';
	xml_data = xml_data + "<event>" + event + "</event>";
	xml_data = xml_data + "<expires>3600</expires>";
	xml_data = xml_data + "<channelSetId>" + bwconnection.channelSetId + "</channelSetId>";
	xml_data = xml_data + '<applicationId>' + bwconnection.applicationId + '</applicationId>';
	xml_data = xml_data + "</Subscription>";

	req.write(xml_data);
	req.end();
	log.info('-> POST ' + BW_URL + "/com.broadsoft.xsi-events/v2.0/serviceprovider/" + bwconnection.serviceprovider + "/group/" + bwconnection.groupId + '\r\n' + xml_data + '\r\n');
};

sendResponseEvent = function(eventId){
	console.log("-> INFO: sendResponseEvent");
	var options = {
		host: BW_URL,
		path: "/com.broadsoft.xsi-events/v2.0/channel/eventresponse",
		method: 'POST',
		auth: bwconnection.groupadmin + ':' + bwconnection.groupadminpassword,
		headers: {'Content-Type': 'text/xml'}
	};
	var http = require('http');
	var req = http.request(options, function(res){
		if(res.statusCode != 200){
			console.log("<- response from BW: " + res.statusCode);
			log.error("<- response from BW: " + res.statusCode);
		}
	});

	req.on('error', function(e) {
  		console.log('problem with sendResponseEvent request: ' + e.message);
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
			startHeartbeat();
			//channel events subscription
			eventSubscription('Advanced Call');
		});
	}else if(chunk.indexOf('<ChannelHeartBeat ') >= 0){
		//TODO: for now do nothing as it is only answer from heartbeat
	}else if(chunk.indexOf('ChannelTerminatedEvent') >= 0){
		console.log("WARNING: ChannelTerminatedEvent <-");
		bwconnection.channelId = '';
	}else if(chunk.indexOf('SubscriptionTerminatedEvent') >= 0){//will open a new subscription
		console.log('WARNING: SubscriptionTerminatedEvent <-');
		eventSubscription('Advanced Call');
	}else if(chunk.indexOf('<xsi:Event ') >= 0){//xsi:Event received. Now see if it is channel disconnection
		//for every xsi:Event, needs to send event Response
		var xmldoc = new DOMParser().parseFromString(chunk,'text/xml');	
		var eventid = xmldoc.getElementsByTagName('xsi:eventID').item(0).firstChild.nodeValue;
		sendResponseEvent(eventid);
		var userid = xmldoc.getElementsByTagName('xsi:userId').item(0).firstChild.nodeValue;
		var targetid = xmldoc.getElementsByTagName('xsi:targetId').item(0).firstChild.nodeValue;
		var remoteparty = xmldoc.getElementsByTagName('xsi:address').item(0).firstChild.nodeValue.substring(5);
		var eventType = xmldoc.getElementsByTagName('xsi:eventData').item(0).getAttribute('xsi1:type').trim();
		eventType = eventType.substring(4);//string off the prefix "xsi:" from the eventType
		switch(eventType){
			case 'CallReceivedEvent':
				var calltype = xmldoc.getElementsByTagName('xsi:callType').item(0).firstChild.nodeValue;
				if(calltype == 'Group'){
					remoteparty = xmldoc.getElementsByTagName('xsi:name').item(0).firstChild.nodeValue;
				}else if(calltype == 'Network'){
					var countrycode = xmldoc.getElementsByTagName('xsi:address').item(0).getAttribute('countryCode');
					if(remoteparty.indexOf(countrycode) >= 0){
						remoteparty = remoteparty.replace(countrycode, '0');
					}
				}
				console.log("<- INFO: CallReceivedEvent(from: " + remoteparty + " to: " + targetid + ")");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						credentials[index].callhalf = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue; 
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallReceivedEvent</eventtype>';
						incomingcallXml += '<callerid>' + remoteparty + '</callerid>';
						incomingcallXml += '</Event>';
						responseobj.send(incomingcallXml);
						console.log("INFO: CallReceivedEvent -> SFDC");
						break;
					}
				}
				break;
			case 'CallOriginatedEvent':
				console.log("<- INFO: CallOriginatedEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						credentials[index].callhalf = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue; 
						var responseobj = credentials[index].appId;
						var outgoingcallXml = '<Event>';
						outgoingcallXml += '<eventtype>CallOriginatedEvent</eventtype>';
						outgoingcallXml += '<callingid>' + remoteparty + '</callingid>';
						outgoingcallXml += '</Event>';
						responseobj.send(outgoingcallXml);
						console.log("INFO: CallOriginatedEvent -> SFDC");
						break;
					}
				}
				break;
			case 'CallAnsweredEvent':
				console.log("<- INFO: CallAnsweredEvent");
				var countrycode = xmldoc.getElementsByTagName('xsi:address').item(0).getAttribute('countryCode');
				if(remoteparty.indexOf(countrycode) >= 0){
					remoteparty = remoteparty.replace(countrycode, '0');
				}
				for(var index in credentials){
					if(credentials[index].username === targetid){
						//credentials[index].callhalf = xmldoc.getElementsByTagName('xsi:callId').item(0).firstChild.nodeValue;
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallAnsweredEvent</eventtype>';
						incomingcallXml += '<callerid>' + remoteparty + '</callerid>';
						incomingcallXml += '</Event>';
						responseobj.send(incomingcallXml);
						console.log("INFO: CallAnswered -> SFDC");
						break;
					}
				}
				break;
			case 'CallReleasedEvent':
				console.log("<- INFO: CallReleasedEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallReleasedEvent</eventtype>';
						incomingcallXml += '</Event>';
						responseobj.send(incomingcallXml);
						console.log("-> INFO: CallReleasedEvent");
						break;
					}
				}
				break;
			case 'CallHeldEvent':
				console.log("<- INFO: CallHeldEvent");
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallHeldEvent</eventtype>';
						incomingcallXml += '</Event>';
						responseobj.send(incomingcallXml);
						break;
					}
				}
				break;
			case 'CallRedirectedEvent':
				console.log('<- INFO: CallRedirectedEvent');
				for(var index in credentials){
					if(credentials[index].username === targetid){
						var responseobj = credentials[index].appId;
						var incomingcallXml = '<Event>';
						incomingcallXml += '<eventtype>CallRedirectedEvent</eventtype>';
						incomingcallXml += '</Event>';
						responseobj.send(incomingcallXml);
						break;
					}
				}
				break;
			case 'CallUpdatedEvent':
				console.log("<- INFO: CallUpdatedEvent");
				break;
			case 'CallSubscriptionEvent':
				console.log("<- INFO: CallSubscriptionEvent");
				break;
			case 'CallTransferredEvent':
				console.log('<- INFO: CallTransferredEvent');
				break;
			case 'DoNotDisturbEvent':
			case 'CallForwardingAlwaysEvent':
			case 'RemoteOfficeEvent':
			case 'CallRetrievedEvent':
				break;
			default:
		}
	}
	log.info('<- ' + chunk);
};

//******************************** XSI actions processing work functions ***************************
acceptCall = function(username){
	var callhalf;
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			callhalf = credentials[i].callhalf;
			password = credentials[i].password;
		}
	}
	console.log("-> INFO: acceptCall");
	var options = {
	  host: BW_URL,
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
	console.log("-> INFO: makeCall to destination " + destination + " and username " + username);
	var password;
	for(var i in credentials){
		if(credentials[i].username === username){
			password = credentials[i].password;
		}
	}
	var options = {
	  host: BW_URL,
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/new?address=" + encodeURIComponent(destination),
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
	log.info('-> POST ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/new?address=" + encodeURIComponent(destination) + '\r\n');
};

disconnectCall = function(username){
	console.log("-> disconnectCall");
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
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf,
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
	log.info('-> DELETE ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + '\r\n');
};

transferCall = function(username, destination){
	console.log("-> transferCall");
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

declineCall = function(username){
	console.log("-> declineCall");
	console.log("username is: " + username);
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
	  path: "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "/?decline=true",
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
	log.info('-> DELETE ' + BW_URL + "/com.broadsoft.xsi-actions/v2.0/user/" + username + "/calls/" + callhalf + "/?decline=true" + '\r\n');
};

//**************** listen for incoming events ***********************
var opts = {key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem')};

/*http.createServer(app).listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});*/

mainhttps = require('https'); //the https object to connect the client with the proxy
mainhttps.createServer(opts, app).listen(app.get('port'), function(){
	console.log('Express HTTPS server listening on port ' + app.get('port'));
});
//**************** start the server by registering a channel in BW ************
requestChannel();