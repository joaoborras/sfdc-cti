
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
	console.log('searchAndGetScreenPopUrl called');
	//Invokes API method
    sforce.interaction.searchAndGetScreenPopUrl(caller, '', 'inbound', identifyCaller_callback);
};

var identifyCaller_callback = function (response){
	console.log("searchAndGetScreenPopUrl_callback called");
    if (response.result) {
    	console.log(response.result);
    	var obj = JSON.parse(response.result);
    	if(obj.screenPopUrl != ''){
    		var userIdentifier = obj.screenPopUrl.replace('/', '');
    		//alert("Hello " + obj[userIdentifier].Name);
    		//$('#number').text('Call From: ' + obj[userIdentifier].Name);
    		localStorage.setItem('callingParty', obj[userIdentifier].Name)
    	}else{
    		//$('#number').text('Call From: ' + localStorage.getItem('callingParty'));
    	}
    }else{
    	console.log(response.error);
    }
    $('#number').text('Call From: ' + localStorage.getItem('callingParty'));
};

function startHeartbeat(){
	setTimeout(function(){
		$.ajax({
			url: '/heartbeat/?username=' + localStorage.getItem('username'),
			success:function(result){
				startHeartbeat();
			}
		});
	}, 15000);
};

function connect(username){
	var mainXhr = new XMLHttpRequest();
	console.log('-> /connect/?username=' + username);
	var url = '/connect/?username=' + username;
	mainXhr.open('GET', url, true);
	mainXhr.onreadystatechange = function() {
		console.log('mainXhr.onreadystatechange called. State is ' + mainXhr.readyState);
		if(mainXhr.readyState == 4){
			var eventtype = $(mainXhr.responseText).find('eventtype').text();
			switch(eventtype){
				case 'CallReceivedEvent':
					console.log("CallReceivedEvent received");
					var callerid = $(mainXhr.responseText).find('callerid').text();
					localStorage.setItem('callingParty', callerid);
					localStorage.setItem('calledtype', "inbound");
					localStorage.setItem("softphonestate", 'incomingcall');
					localStorage.setItem('callLogSubject', 'Call On');
					identifyCaller(callerid);
					//sforce.interaction.searchAndScreenPop(callerid,'','inbound');
					break;
				case 'CallOriginatedEvent':
					console.log("CallOriginatedEvent received");
					var callingid = $(mainXhr.responseText).find('callingid').text();
					localStorage.setItem('callNumber', callingid);
					localStorage.setItem('calledtype', "outbound");
					localStorage.setItem("softphonestate", 'outgoingcall');
					localStorage.setItem('callLogSubject', 'Call On');
					$('#number').html('Call To: ' + callingid);
					break;
				case 'CallAnsweredEvent':
					console.log("CallAnsweredEvent received");
					var callstarttime = new Date().getTime();
					localStorage.setItem('callStartTime', callstarttime);
					$('#number').text('Talking');
					localStorage.setItem("softphonestate", 'busy');
					//change background color of "call" icon to #ff0000(red)
					$('#call').css('background-color', '#ff0000');
					var callerid = $(mainXhr.responseText).find('callerid').text();
					sforce.interaction.searchAndScreenPop(callerid,'','inbound');
					break;
				case 'CallReleasedEvent':
					console.log("CallReleasedEvent received");
					var callendtime = new Date().getTime();
					localStorage.setItem('callEndTime', callendtime);
					localStorage.setItem("softphonestate", 'free');
					localStorage.setItem('callDisposition', 'successfull');
					releaseLocalStorage();
					$('#number').html("");
					//change background color of "call" icon to #0c3(green)
					$('#call').css('background-color', '#093');
					sforce.interaction.getPageInfo(saveCallLog); //save call log in SFDC
					break;
				default:
			}
		}
	};
	mainXhr.onloadend = function() {
		connect(username);
	};
	mainXhr.send();
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
				connect(localStorage.getItem("username"));
				startHeartbeat();
				$('#loggeduser').text(localStorage.getItem(('username')));
			}else{
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
	bwlogout(localStorage.getItem('username'));
});

issignedinserver = function(username, callback){  
	$.ajax({url: "/issignedin/?username=" + username, 
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
		success:function(result){
			$( "#credentials-modal-form" ).dialog( "close" );
			localStorage.setItem("loggedin", true);
			localStorage.setItem('username', username);
			$('#call').css('background-color', '#093');
			localStorage.setItem('softphonestate', 'free');
			connect(username);
			startHeartbeat();
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
		success:function(result){
			localStorage.removeItem('softphonestate');
			localStorage.removeItem('loggedin');
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
	$.ajax({url: "/accept_call/?username=" + username, 
		success:function(result){
			console.log("result: " + result);
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

disconnectcall = function(){
	var username = localStorage.getItem("username");
	$.ajax({url: "/disconnect_call/?username=" + username, 
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

saveCallLog = function (response) {
    var timeStamp = new Date().toString();
    timeStamp = timeStamp.substring(0, timeStamp.lastIndexOf(':') + 3);             
    var currentDate = new Date();           
    var currentDay = currentDate.getDate();
    var currentMonth = currentDate.getMonth()+1;
    var currentYear = currentDate.getFullYear();
            
    var dueDate = currentYear+ '-' + currentMonth + '-' + currentDay;
    var saveParams = 'Subject=' + localStorage.getItem('callLogSubject') + timeStamp;
    saveParams += '&Status=In Progress';                 
    //saveParams += '&CallType=' + localStorage.getItem('calledtype');
    saveParams += '&Activitydate=' + dueDate;
    //saveParams += '&CallObject=' + currentDate.getTime();
    saveParams += '&Phone=' + localStorage.getItem('callNumber');   
    saveParams += '&Description=Test call';//TODO: have to opena dialog for the agent to 
    //fill in the text + callLogText.value;   
    /*var callDisposition = getSelectedCallDisposition();
    if(callDisposition) {
        saveParams += '&CallDisposition=' + callDisposition.value;       
    } */
    //saveParams += '&CallDisposition=' + localStorage.getItem('callDisposition');
    //saveParams += '&CallDurationInSeconds=' + Math.floor((currentDate.getTime() - localStorage.getItem('callStartTime')/ 1000));
    saveParams += '&Priority=High';
            
    var result = JSON.parse(response.result);
    if(result.objectId.substr(0,3) == '003') {
        saveParams += '&whoId=' + result.objectId;                    
    } else {
        saveParams += '&whatId=' + result.objectId;            
    }
    sforce.interaction.saveLog('Task', saveParams, function(response){
     	if(response.result){
       		console.log("success in sforce.interaction.saveLog: " + response.result);
       	}else{
       		console.log("error in sforce.interaction.saveLog: " + response.error);
       	}
    });       
};

$('#call').click(function(){
	var state = localStorage.getItem("softphonestate");
	switch(state){
		case 'free':
			makecall($('#number').text());
			break;
		case 'busy':
			disconnectcall();
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
	$.ajax({url: "/decline_call/?username=" + username, 
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

