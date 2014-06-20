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
			localStorage.setItem('calledtype', "outbound");
			localStorage.setItem('callLogSubject', 'Call On');
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

transferCall = function(){
	var destination = $('#extensioninput').val();
	var username = localStorage.getItem("username");
	$.ajax({url: "/transfer_call/?username=" + username + "&destination=" + destination, 
		cache: false,
		success:function(result){
			
		},
		error:function(xhr, status, result){
			console.log("Status: " + status + "; result: " + result);
		}
	});
};

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
//Until here