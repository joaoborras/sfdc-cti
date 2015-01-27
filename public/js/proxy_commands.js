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
			console.log("received success from bwlogin ajax call");
			$( "#credentials-modal-form" ).dialog( "close" );
			localStorage.setItem("loggedin", true);
			localStorage.setItem('username', username);
			localStorage.setItem('softphonestate', 'free');
			localStorage.setItem('destinationnumber', '');
			$('#call').css('background-color', '#093');
			connect(username);
			$('#loggeduser').text(localStorage.getItem(('username')));
			$('#signout').css('display', 'inline');
		},
		error: function(xhr, status, result){
			console.log("received error from bwlogin ajax call");
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
			console.log("received success from bwlogout ajax call");	
		},
		error: function(xhr, status, result){
			console.log("received error from bwlogout ajax call");
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
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

transferCall = function(){
	var destination = $('#extensioninput').val();
	var username = localStorage.getItem("username");
	$.ajax({url: "/make_call/?username=" + username + "&destination=" + destination,
		cache: false,
		success:function(result){
			
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

consultTransfer = function(){
	var username = localStorage.getItem("username");
	var callid1 = localStorage.getItem('callId');
	var callid2 = localStorage.getItem('callId2');
	$.ajax({url: "/consult_transfer_call/?username=" + username + "&callid1=" + callid1 + "&callid2=" + callid2,
		cache: false,
		success:function(result){
			
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
}

holdCall = function(callid){
	console.log("holdCall called");
	var username = localStorage.getItem("username");
	$.ajax({url: "/hold_call/?username=" + username + "&callid=" + callid, 
		cache: false,
		success:function(result){
			
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

retrieveCall = function(callid){
	var username = localStorage.getItem("username");
	$.ajax({url: "/retrieve_call/?username=" + username + "&callid=" + callid, 
		cache: false,
		success:function(result){
			
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

getUserDir = function(){
	var source = $('#directory-entry-template').html();
	var template = Handlebars.compile(source);
	var html;
	var username = localStorage.getItem('username');
	$.ajax({url: "/get_directoryforuser/?username=" + username, 
		success:function(result){;
			var directory = {users: []};
			var parser = new DOMParser();
			var xmldoc = parser.parseFromString(result, "text/xml");
			var totalusers = xmldoc.getElementsByTagName('numberOfRecords').item(0).firstChild.nodeValue;
			var extension;
			for(var x=0; x<totalusers;x++){
				if(xmldoc.getElementsByTagName('extension').item(x)){
					extension = xmldoc.getElementsByTagName('extension').item(x).firstChild.nodeValue;
				}else{
					extension = '';
				}
				directory.users.push({
					firstname: xmldoc.getElementsByTagName('firstName').item(x).firstChild.nodeValue,
					lastname: xmldoc.getElementsByTagName('lastName').item(x).firstChild.nodeValue,
					extension: extension,
				});
			}
			html = template(directory);
			$('#userdir').html(html);
			$( "#calltransfer-modal-form" ).dialog( "open" );
			localStorage.setItem('calltransfermodal', 'open');
		},
	});
};

getUserCallHistory = function(){
	var source = $('#callhistory-entry-template').html();
	var template = Handlebars.compile(source);
	var html;
	var username = localStorage.getItem('username');
	$.ajax({url: "/get_callhistoryforuser/?username=" + username + "&calllogtype=EnhancedCallLogs", 
		success:function(result){
			var callhistory = {logentry: []};
			var parser = new DOMParser();
			var xmldoc = parser.parseFromString(result, "text/xml");
			var placed = xmldoc.getElementsByTagName('placed').item(0).childNodes.length;
			var received = xmldoc.getElementsByTagName('received').item(0).childNodes.length;
			var missed = xmldoc.getElementsByTagName('missed').item(0).childNodes.length;
			var maxvalue = Math.max(placed, received, missed);
			var nodename, callednumber, callingnumber, missednumber;
			var placedcallstarttime, answertime, releasetime, placedcallcallduration,
				receivedcallstarttime, receivedcallcallduration, missedcallstarttime;

			for(var x=0;x<=maxvalue-1;x++){
				if(x<=placed){
					try{
						nodename = xmldoc.getElementsByTagName('placed').item(0).childNodes[x].nextSibling.childNodes[4].nodeName;
						if(nodename == 'dialedNumber'){
							callednumber = xmldoc.getElementsByTagName('placed').item(0).childNodes[x].nextSibling.childNodes[4].childNodes[0].nodeValue;
							placedcallstarttime = new Date(+xmldoc.getElementsByTagName('placed').item(0).childNodes[x].nextSibling.childNodes[17].childNodes[0].nodeValue);
							answertime = new Date(+xmldoc.getElementsByTagName('placed').item(0).childNodes[x].nextSibling.childNodes[18].childNodes[0].nodeValue);
							releasetime = new Date(+xmldoc.getElementsByTagName('placed').item(0).childNodes[x].nextSibling.childNodes[19].childNodes[0].nodeValue);
							var callduration = releasetime - answertime;
							placedcallcallduration = moment.duration(callduration).hours()+":"+
							moment.duration(callduration).minutes()+":"+
							moment.duration(callduration).seconds();
						}
					}catch(error){
						console.log('error when x = ' + x);
					}
				}else{
					callednumber = '';
					placedcallstarttime = '';
				}

				if(x<=received){
					try{
						nodename = xmldoc.getElementsByTagName('received').item(0).childNodes[x].nextSibling.childNodes[4].nodeName;
						if(nodename == 'callingPresentationNumber'){
							var callingnumber = xmldoc.getElementsByTagName('received').item(0).childNodes[x].nextSibling.childNodes[4].childNodes[0].nodeValue;
							receivedcallstarttime = new Date(+xmldoc.getElementsByTagName('received').item(0).childNodes[x].nextSibling.childNodes[14].childNodes[0].nodeValue);
							answertime = new Date(+xmldoc.getElementsByTagName('received').item(0).childNodes[x].nextSibling.childNodes[15].childNodes[0].nodeValue);
							releasetime = new Date(+xmldoc.getElementsByTagName('received').item(0).childNodes[x].nextSibling.childNodes[16].childNodes[0].nodeValue);
							var callduration = releasetime - answertime;
							receivedcallcallduration = moment.duration(callduration).hours()+":"+
							moment.duration(callduration).minutes()+":"+
							moment.duration(callduration).seconds();
						}
					}catch(error){}
				}
				else{
					callingnumber = '';
					receivedcallstarttime = '';
				}

				if(x<=missed){
					try{
						nodename = xmldoc.getElementsByTagName('missed').item(0).childNodes[x].nextSibling.childNodes[4].nodeName;
						if(nodename == 'callingPresentationNumber'){
							var missednumber = xmldoc.getElementsByTagName('missed').item(0).childNodes[x].nextSibling.childNodes[4].childNodes[0].nodeValue;
							missedcallstarttime = new Date(+xmldoc.getElementsByTagName('missed').item(0).childNodes[x].nextSibling.childNodes[14].childNodes[0].nodeValue);
						}
					}catch(error){}
				}
				else{
					missednumber = '';
					missedcallstarttime = '';
				}

				callhistory.logentry.push({
					calledNumber: callednumber,
					callingNumber: callingnumber,
					missedNumber: missednumber,
					placedCallstartTime: placedcallstarttime,
					placedCallcallDuration: placedcallcallduration,
					receivedCallstartTime: receivedcallstarttime,
					receivedCallcallDuration: receivedcallcallduration,
					missedCallstartTime: missedcallstarttime,
				});
			}
			html = template(callhistory);
				$('#usercalllog').html(html);
				$('#usercalllog').css('display', '');
				$('#entry-accordion').accordion({
				collapsible: true
			});
				localStorage.setItem('callhistory', 'open');
		},
	});
};
//Until here