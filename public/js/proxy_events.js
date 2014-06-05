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
		//Will try to connect again until it gets a connection
		//$("#dialog_mainhttp_disconnection").dialog("open");
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
			//$("#dialog_mainhttp_disconnection").dialog("close");
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
		case 'CallRedirectedEvent':
			if(localStorage.getItem('calltransfermodal') == 'open'){
				$( "#calltransfer-modal-form" ).dialog( "close" );
				localStorage.removeItem('calltransfermodal');
			}
			break;
		default:
	}
};