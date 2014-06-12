var mainXhr;

function startHeartbeat(){
	if(localStorage.getItem("loggedin") == "true"){
		$.ajax({
			cache:false,
			url: '/heartbeat/?username=' + localStorage.getItem('username'),
			success:function(result){
				//startHeartbeat();
			},
			error: function(xhr, status, result){//probably proxy crush
				console.log('Main HTTP session closed by proxy crash.');
				$("#dialog_mainhttp_disconnection").dialog("open");
				localStorage.removeItem('softphonestate');
				localStorage.setItem("loggedin", false);
				localStorage.removeItem('username');
			}
		});
	}
};

function connect(username){
	mainXhr = new XMLHttpRequest();
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
		console.log('closing main http session');
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
		case 'DisconnectionEvent'://sent when the proxy finsihes gracefully
			console.log('Main HTTP session closed by proxy gracefull close.');
			$("#dialog_mainhttp_disconnection").dialog("open");
			localStorage.removeItem('softphonestate');
			localStorage.setItem("loggedin", false);
			localStorage.removeItem('username');
			localStorage.removeItem('takingnotes');
			mainXhr.abort();
			break;
		case 'LogOutResponse':
			console.log('<- LogOutResponse');
			localStorage.removeItem('softphonestate');
			localStorage.setItem("loggedin", false);
			localStorage.removeItem('username');
			localStorage.removeItem('takingnotes');
			$("#settings-modal-menu").dialog('close');
			$( "#credentials-modal-form" ).dialog( "open" );
			$('#loggeduser').text('');	
			mainXhr.abort();
			$('#signout').css('display', 'none');
			break;
		case 'HeartBeatResponse':
			console.log('<- HeartBeatResponse');
			setTimeout(function(){
				startHeartbeat();
			}, 15000);
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
				localStorage.setItem('holdstate', 'free');
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
			localStorage.setItem('holdstate', 'free');
			$('#number').html('Call To: ' + callingid);
			break;
		case 'CallAnsweredEvent':
			console.log("<- CallAnsweredEvent");
			var callstarttime = new Date().getTime();
			localStorage.setItem('callStartTime', callstarttime);
			localStorage.setItem("softphonestate", 'busy');
			$('#number').text('Talking');
			//change background color of "call" icon to #ff0000(red)
			$('#call').css('background-color', '#ff0000');
			var callerid = $(chunk).find('callerid').text();
			sforce.interaction.searchAndScreenPop(callerid,'','inbound', searchAndGetScreenPopUrl_callback);
			$('#takenotesform').css('display', 'inline');
			localStorage.setItem('takingnotes', 'true');
			break;
		case 'CallReleasedEvent':
			var callid = $(chunk).find('callid').text();
			console.log("<- CallReleasedEvent(callid: " + callid + ")");
			if(callid == localStorage.getItem('callId')){
				var callendtime = new Date().getTime();
				localStorage.setItem('callEndTime', callendtime);
				localStorage.setItem("softphonestate", 'free');
				localStorage.removeItem('holdstate');
				$('#number').html("");
				//change background color of "call" icon to #0c3(green)
				$('#call').css('background-color', '#093');
				//will call the function below when the user press "Save" in take notes area
				//sforce.interaction.getPageInfo(saveCallLog); //save call log in SFDC
			}
			break;
		case 'CallRedirectedEvent':
			if(localStorage.getItem('calltransfermodal') == 'open'){
				$( "#calltransfer-modal-form" ).dialog( "close" );
				localStorage.removeItem('calltransfermodal');
			}
			break;
		case 'CallHeldEvent':
			$('#hold').attr('id', 'retrieve');
			localStorage.setItem('holdstate', 'held');
			break;
		case 'CallRetrievedEvent':
			$('#retrieve').attr('id', 'hold');
			localStorage.setItem('holdstate', 'free');
			break;
		default:
	}
};