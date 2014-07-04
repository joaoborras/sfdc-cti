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
				localStorage.setItem("softphonestate", 'incomingcall');
				//localStorage.setItem('holdstate', 'free');
				identifyCaller(callerid);
				//sforce.interaction.searchAndScreenPop(callerid,'','inbound');
				pulseCallButton();
			}else{
				declinecall(callid);
			}
			break;
		case 'CallOriginatedEvent':
			switch(localStorage.getItem('softphonestate')){
				case 'free':
					var callid = $(chunk).find('callid').text();
					var callingid = $(chunk).find('callingid').text();
					console.log("<- CallOriginatedEvent(callid: " + callid + ")");
					localStorage.setItem('callNumber', callingid);
					localStorage.setItem('callId', callid);
					localStorage.setItem("softphonestate", 'outgoingcall');
					//localStorage.setItem('holdstate', 'free');
					$('#number').html('Call To: ' + callingid);
					pulseCallButton();
					break;
				case 'transferring_free':
					var callid2 = $(chunk).find('callid').text();
					localStorage.setItem('callId2', callid2);
					localStorage.setItem('softphonestate', 'transferring_calling');
					break;
				default:
			}
			break;
		case 'CallAnsweredEvent':
			switch(localStorage.getItem('softphonestate')){
				case 'transferring_calling':
					localStorage.setItem('softphonestate', 'transferring_consulting');
					break;
				case 'incomingcall':
				case 'outgoingcall':
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
				default:
			}
			break;
		case 'CallReleasedEvent':
			var callid = $(chunk).find('callid').text();
			console.log("<- CallReleasedEvent(callid: " + callid + ")");
			switch(localStorage.getItem('softphonestate')){
				case 'busy':
				case 'transferring':
				case 'outgoingcall':
				case 'incomingcall':
				case 'held':
				case 'transferring_calling':
				case 'transferring_free':
					if(callid == localStorage.getItem('callId') || callid == localStorage.getItem('callId2')){
						var callendtime = new Date().getTime();
						localStorage.setItem('callEndTime', callendtime);
						localStorage.setItem("softphonestate", 'free');
						//localStorage.removeItem('holdstate');
						localStorage.setItem('destinationnumber', '');
						$('#destination').val('');
						$('#number').html("");
						//change background color of "call" icon to #0c3(green)
						$('#call').css('background-color', '#093');
						//bring the Transfer button back to its original state
						$('#transferring').attr('id', 'transfer');
						//finally, remove the callid that was released
						if(callid == localStorage.getItem('callId')){
							localStorage.removeItem('callId');
						}else if(callid == localStorage.getItem('callId2')){
							localStorage.removeItem('callId2');
						}
						//will call the function below when the user press "Save" in take notes area
						//sforce.interaction.getPageInfo(saveCallLog); //save call log in SFDC
					}
					break;
				case 'transferring_consulting':
					localStorage.setItem("softphonestate", 'transferring');
					if(callid == localStorage.getItem('callId')){
						localStorage.removeItem('callId');
					}else if(callid == localStorage.getItem('callId2')){
						localStorage.removeItem('callId2');
					}
					break;
				default:
			}
			break;
		case 'CallRedirectedEvent':
			console.log("<- CallRedirectedEvent");
			switch(localStorage.getItem('softphonestate')){
				case 'transferring_consulting':
					localStorage.setItem('softphonestate', 'calltransferred');
					var callid = localStorage.getItem('callId');
					var callendtime = new Date().getTime();
					localStorage.setItem('callEndTime', callendtime);
					localStorage.setItem("softphonestate", 'free');
					//localStorage.removeItem('holdstate');
					localStorage.setItem('destinationnumber', '');
					localStorage.removeItem('callid2');
					$('#destination').val('');
					$('#number').html("");
					//change background color of "call" icon to #0c3(green)
					$('#call').css('background-color', '#093');
					$('#transferring').attr('id', 'transfer');
					if(localStorage.getItem('calltransfermodal') == 'open'){
						$( "#calltransfer-modal-form" ).dialog( "close" );
						localStorage.removeItem('calltransfermodal');
					}
					break;
				case 'incomingcall': //this happens when Forward always is set
					localStorage.setItem("softphonestate", 'free');
					localStorage.setItem('destinationnumber', '');
					$('#number').html("Call Transferred");
					//change background color of "call" icon to #0c3(green)
					$('#call').css('background-color', '#093');
					//remove the callid that was released
					localStorage.removeItem('callId');
					break;
				default:
			}
			break;
		case 'CallHeldEvent':
			switch(localStorage.getItem('softphonestate')){
				case 'transferring':
					$('#transfer').attr('id', 'transferring');
					localStorage.setItem('softphonestate', 'transferring_free');
					//getUserDir();
					break;
				case 'busy':
					$('#hold').attr('id', 'retrieve');
					localStorage.setItem('softphonestate', 'held');
					break;
				default:
			}
			break;
		case 'CallRetrievedEvent':
			console.log('CallRetrievedEvent');
			switch(localStorage.getItem('softphonestate')){
				case 'transferring':
				case 'transferring_free':
					$('#transferring').attr('id', 'transfer');
					localStorage.setItem('softphonestate', 'busy');
					break;
				case 'held':
					$('#retrieve').attr('id', 'hold');
					//localStorage.setItem('holdstate', 'free');
					localStorage.setItem('softphonestate', 'busy');
					break;
				default:
			}
			break;
		case 'CallTransferredEvent':
			console.log("<- CallTransferredEvent");
			break;
		case 'CallUpdatedEvent':
			/*var allowanswer = $(chunk).find('allowAnswer').text();
			if(allowanswer == '1'){
				acceptcall();
			}*/
			if($(chunk).find('allowAnswer')){
				acceptcall();
			}
			break;
		default:
	}
};