
$('.digit').click(function(){
    var number = $(this).html();
    $('#number').append(number);
});

$('#clear').click(function(){
    $('#number').empty();
});

$('#delete').click(function(){
    var text = $('#number').text();
    text = text.slice(0, text.length-1);
    $('#number').html(text);
});

$('#show_hidedialpad').click(function(){
    var dialpaddisplay = $('#dialpad').css('display');
    if(dialpaddisplay == 'none'){
        $('#dialpad').css('display', 'inline');
        localStorage.setItem('dialpadstatus', 'inline');
        $(this).text("Hide dialpad");
    }else if(dialpaddisplay == 'inline'){
        $('#dialpad').css('display', 'none');
        localStorage.setItem('dialpadstatus', 'none');
        $(this).text("Show dialpad");
    }
});

function identifyCaller(caller){
	//Invokes API method
    sforce.interaction.searchAndGetScreenPopUrl(caller, '', 'inbound', identifyCaller_callback);
};

var identifyCaller_callback = function (response){
    if (response.result) {
    	console.log(response.result);
    	var obj = JSON.parse(response.result);
    	if(obj.screenPopUrl != ''){
    		var userIdentifier = obj.screenPopUrl.replace('/', '');
    		localStorage.setItem('callingParty', obj[userIdentifier].Name)
    	}
    }else{
    	console.log(response.error);
    }
    $('#number').text('Call From: ' + localStorage.getItem('callingParty'));
};

var searchAndGetScreenPopUrl_callback = function(response){
	if(response.result){
		console.log('searchAndGetScreenPopUrl response: ' + response.result);
	}else{
		console.log(response.error);
	}
};

function startHeartbeat(){
	if(localStorage.getItem("loggedin") == "true"){
		setTimeout(function(){
			$.ajax({
				cache:false,
				url: '/heartbeat/?username=' + localStorage.getItem('username'),
				success:function(result){
					startHeartbeat();
				}
			});
		}, 15000);
	}
};

function connect(username){
	var mainXhr = new XMLHttpRequest();
	console.log('-> /connect/?username=' + username);
	var url = '/connect/?username=' + username;
	mainXhr.open('POST', url, true);
	var resbuffer = '';
	var index = 0;
	mainXhr.onreadystatechange = function(){
		console.log(mainXhr.responseText.substring(index,mainXhr.responseText.length));
		var chunk = mainXhr.responseText.substring(index,mainXhr.responseText.length);
		index = mainXhr.responseText.length;
		if(chunk.indexOf('</Event>')){
			resbuffer += chunk;
			var resbody = resbuffer;
			resbuffer = '';
			processchunk(resbody);
		}else{
			resbuffer += chunk;
		}
	};
	mainXhr.onloadend = function() {
		console.log('Main HTTP session closed! Will connect again in 5 secs...');
		alert('Main HTTP session closed! Will connect again in 5 secs...');
		//Will try to connect again until it gets a connection
		setTimeout(function(){
			connect(localStorage.getItem('username'));
		}, 5000);
	};
	mainXhr.send();
};

processchunk = function(chunk){
	var eventtype = $(chunk).find('eventtype').text();
	switch(eventtype){
		case 'ConnectResponse':
			console.log('<- ConnectResponse');
			startHeartbeat();
			break;
		case 'HeartBeatResponse':
			console.log('<- HeartBeatResponse');
			break;
		case 'CallReceivedEvent':
			var callid = $(chunk).find('callid').text();
			var callerid = $(chunk).find('callerid').text();
			console.log("<- CallReceivedEvent(callerid: " + callerid + "; callid: " + callid);
			var softphonestate = localStorage.getItem('softphonestate');
			if(softphonestate == "free" || softphonestate == "outgoingcall"){//only gets first call
				localStorage.setItem('callingParty', callerid);
				localStorage.setItem('callId', callid);
				localStorage.setItem('calledtype', "inbound");
				localStorage.setItem("softphonestate", 'incomingcall');
				localStorage.setItem('callLogSubject', 'Call On');
				identifyCaller(callerid);
				//sforce.interaction.searchAndScreenPop(callerid,'','inbound');
				pulseCallButton();
			}else{
				declinecall(callid);
			}
			break;
		case 'CallOriginatedEvent':
			var callid = $(chunk).find('callid').text();
			var callingid = $(chunk).find('callingid').text();
			console.log("<- CallOriginatedEvent(callid: " + callid + ")");
			localStorage.setItem('callNumber', callingid);
			localStorage.setItem('callId', callid);
			localStorage.setItem('calledtype', "outbound");
			localStorage.setItem("softphonestate", 'outgoingcall');
			localStorage.setItem('callLogSubject', 'Call On');
			$('#number').html('Call To: ' + callingid);
			break;
		case 'CallAnsweredEvent':
			console.log("<- CallAnsweredEvent");
			var callstarttime = new Date().getTime();
			localStorage.setItem('callStartTime', callstarttime);
			$('#number').text('Talking');
			localStorage.setItem("softphonestate", 'busy');
			//change background color of "call" icon to #ff0000(red)
			$('#call').css('background-color', '#ff0000');
			var callerid = $(chunk).find('callerid').text();
			sforce.interaction.searchAndScreenPop(callerid,'','inbound', searchAndGetScreenPopUrl_callback);
			break;
		case 'CallReleasedEvent':
			var callid = $(chunk).find('callid').text();
			console.log("<- CallReleasedEvent(callid: " + callid + ")");
			if(callid == localStorage.getItem('callId')){
				var callendtime = new Date().getTime();
				localStorage.setItem('callEndTime', callendtime);
				localStorage.setItem("softphonestate", 'free');
				localStorage.setItem('callDisposition', 'successfull');
				$('#number').html("");
				//change background color of "call" icon to #0c3(green)
				$('#call').css('background-color', '#093');
				sforce.interaction.getPageInfo(saveCallLog); //save call log in SFDC
			}
			break;
		default:
	}
};

pulseCallButton = function(){
	$('.pulse').effect('pulsate');
	setTimeout(function(){
		if(localStorage.getItem('softphonestate') == "incomingcall"){
			$('.pulse').effect('pulsate');
			pulseCallButton();
		}
	}, 3000);
};

releaseLocalStorage = function(){
	localStorage.removeItem('callEndTime');
	localStorage.removeItem('callLogSubject');
	localStorage.removeItem('callNumber');
	localStorage.removeItem('callStartTime');
	localStorage.removeItem('calledtype');
	localStorage.removeItem('callingParty');

};

// Callback of API method: setSoftphoneHeight
var setSoftphoneHeightCallback = function (response) {
	// Returns true if SoftPhone height was set successfully, false otherwise.
    if (response.result) {
        console.log('Setting SoftPhone height was successful.');
    }else {
        console.log('Setting softphone height failed.');
    }
};

// Invokes setSoftphoneHeight API method.
function setSoftphoneHeight(height) {
   	sforce.interaction.cti.setSoftphoneHeight(height, setSoftphoneHeightCallback);
};

click2diallistener = function (response) {
	if (response.result) {
        sforce.interaction.setVisible(true);
        if(localStorage.getItem('softphonestate') === 'free'){
            var result = JSON.parse(response.result);
            makecall(result.number);	
        }
    }
};

sforce.interaction.cti.enableClickToDial(); //enable click2dial in SFDC
sforce.interaction.cti.onClickToDial(click2diallistener); //click2dial callback
setSoftphoneHeight(500);

$('document').ready(function(){
	if(localStorage.getItem("loggedin") != "true" || !localStorage.getItem("loggedin")){
		$( "#credentials-modal-form" ).dialog( "open" );
	}else {
		issignedinserver(localStorage.getItem('username'), function(result){
			if(result == true){
				console.log('user is signed in');
				connect(localStorage.getItem("username"));
				$('#loggeduser').text(localStorage.getItem(('username')));
			}else{
				console.log('user is not signed in');
				localStorage.removeItem('softphonestate');
				localStorage.removeItem('loggedin');
				localStorage.removeItem('username');
				localStorage.setItem('softphonestate', 'free');
				$( "#credentials-modal-form" ).dialog( "open" );
			}
		});
	}
	//this is to cope with the fact that sfdc reloads the page during screen pop-up
	var softphonestate = localStorage.getItem("softphonestate");
	if(softphonestate == 'busy'){
		$('#call').css('background-color', '#ff0000');
		$('#number').text('Talking');
	}else if(softphonestate == 'incomingcall'){
		$('#number').text('Call From: ' + localStorage.getItem('callingParty'));
	}else{
		$('#call').css('background-color', '#093')
	}
	//this is to maitain the dialpad display mode during pages refreshes
	var dialpaddisplay = localStorage.getItem('dialpadstatus'); 
	if(dialpaddisplay == 'none'){
        $('#dialpad').css('display', 'none');
        $('#show_hidedialpad').text("Show dialpad");
    }else if(dialpaddisplay == 'inline'){
        $('#dialpad').css('display', 'inline');
        $('#show_hidedialpad').text("Hide dialpad");
    }
});

//Sign In modal form
$( "#credentials-modal-form" ).dialog({
	autoOpen: false,
    modal: true,
    width: 250,
    resizable: false,
    title: "BW Credentials",
    buttons: [
	    {
	    	text: "Sign In",
	    	click: function(){
	    		bwlogin($('#username').val(), $('#password').val());
	    	},
	    	style: "font-size:10px;position:relative;left:-90px",
	    },
	    {
	    	text: "Cancel",
	    	click: function(){
	    		$( "#credentials-modal-form" ).dialog( "close" );
	    	},
	    	style: "font-size:10px;position:relative;left:0px",
	    }
    ]
}); 
//End of Sign In modal form

//Sign out process will delete all localStorage variables and sign out the proxy
$('#signout').click(function(){
	console.log("Signing Out!");
	bwlogout(localStorage.getItem('username'));
});

//Requests to the proxy from here
issignedinserver = function(username, callback){  
	$.ajax({url: "/issignedin/?username=" + username, 
		cache: false,
		success:function(result){
			callback(true);
		},
		error: function(xhr, status, result){
			callback(false);
		}
	});
};

bwlogin = function(username, password){
	$.ajax({url: "/log_in/?username=" + username + "&password=" + password, 
		cache: false,
		success:function(result){
			$( "#credentials-modal-form" ).dialog( "close" );
			localStorage.setItem("loggedin", true);
			localStorage.setItem('username', username);
			$('#call').css('background-color', '#093');
			localStorage.setItem('softphonestate', 'free');
			connect(username);
			$('#loggeduser').text(localStorage.getItem(('username')));
		},
		error: function(xhr, status, result){
			if(xhr.status == 404){
				alert(xhr.status + " - " + result + ": Please verify your credentials");
			}
		}
	});
};

bwlogout = function(username){
	$.ajax({url: "/log_out/?username=" + username, 
		cache: false,
		success:function(result){
			localStorage.removeItem('softphonestate');
			localStorage.setItem("loggedin", false);
			localStorage.removeItem('username');
			$( "#credentials-modal-form" ).dialog( "open" );
			$('#loggeduser').text('');			
		},
		error: function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

acceptcall = function(){
	var username = localStorage.getItem("username");
	console.log("acceptcall function called for " + username);
	$.ajax({url: "/accept_call/?username=" + username, 
		cache: false,
		success:function(result){
			console.log("result: " + result);
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

disconnectcall = function(callid){
	console.log("disconnectcall called for callid: " + callid);
	var username = localStorage.getItem("username");
	$.ajax({url: "/disconnect_call/?username=" + username + "&callid=" + callid,
		cache: false, 
		success:function(result){
			console.log("result: " + result);
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

declinecall = function(callid){
	console.log("declinecall called for callid: " + callid);
	var username = localStorage.getItem("username");
	$.ajax({url: "/decline_call/?username=" + username + "&callid=" + callid, 
		cache: false,
		success:function(result){
			console.log("result: " + result);
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

makecall = function(destination){
	var username = localStorage.getItem("username");
	$.ajax({url: "/make_call/?username=" + username + "&destination=" + destination, 
		cache: false,
		success:function(result){
			$('#number').html("Calling " + destination);
           	localStorage.setItem('callNumber', destination);
			localStorage.setItem('calledtype', "outbound");
			localStorage.setItem('callLogSubject', 'Call On');
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};
//Until here

saveCallLog = function (response) {
    var result = JSON.parse(response.result);
    localStorage.setItem('resultobjectid', result.objectId);
    $('#callwrapup').css('display', 'inline');
};

//control Call Wrap Up form from here
$( "#duedatepicker" ).datepicker({ dateFormat: "yy-mm-dd" });
$('#wrapupok').click(function(){
    event.preventDefault();
    //show the values in wrap up form
    var duedate = $('#duedatepicker').val();
    console.log("Duedate is: " + duedate);
    var subject = $('#subject').val();
    var callresult = $('#callresult').val();
    var priority = $('#priorities').val();
    var status = $('#status').val();
    var comments = $('#comments').val();
            
    var saveParams = 'Subject=' + subject;
    saveParams += '&Status=' + status;                 
    saveParams += '&Activitydate=' + duedate;
    saveParams += '&Phone=' + localStorage.getItem('callNumber');   
    saveParams += '&Description=' + comments;
    saveParams += '&Priority=' + priority;
    saveParams += '&CallDisposition=' + callresult;
            
    var objectId = localStorage.getItem('resultobjectid');

    if(objectId.substr(0,3) == '003') {
        saveParams += '&whoId=' + objectId;                    
    } else {
        saveParams += '&whatId=' + objectId;            
    }
    console.log('Params to be saved in call log: ' + saveParams);
    sforce.interaction.saveLog('Task', saveParams, function(response){
     	if(response.result){
       		console.log("success in sforce.interaction.saveLog: " + response.result);
       	}else{
       		console.log("error in sforce.interaction.saveLog: " + response.error);
       	}
    });

    localStorage.removeItem('resultobjectid');
    $('#callwrapup').css('display', 'none');
});
$('#wrapupcancel').click(function(){
    event.preventDefault();
    $('#callwrapup').css('display', 'none');
    localStorage.removeItem('resultobjectid');
});
//up to here

$('#call').click(function(){
	event.preventDefault();
	var state = localStorage.getItem("softphonestate");
	switch(state){
		case 'free':
			makecall($('#number').text());
			break;
		case 'busy':
			disconnectcall(localStorage.getItem('callId'));
			break;
		case 'incomingcall':
			acceptcall();
			break;
		default:
	} 
});

$('#declinecall').click(function(){
	event.preventDefault();
	var username = $('#username').val();
	$.ajax({url: "/decline_call/?username=" + username + "&callid=" + callid, 
		cache: false,
		success:function(result){
			console.log("result: " + result);
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
});

function getAuthorizationHeader() {
	var header = "Basic " + $.base64.encode($('#username').val() + ":" + $('#password').val());
	return header;
};

