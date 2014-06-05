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

//modal dialog for when the main streaming HTTP connection is lost
$("#dialog_mainhttp_disconnection").dialog({
    autoOpen: false,
    resizable: false,
    height:140,
    width: 250,
    modal: true
});
//end of modal dialog for when the main streaming HTTP connection is lost

//Sign In modal form
$( "#credentials-modal-form" ).dialog({
    autoOpen: false,
    modal: true,
    width: 180,
    resizable: false,
    title: "BW Credentials",
    buttons: [
        {
            text: "Sign In",
            click: function(){
                bwlogin($('#username').val(), $('#password').val());
            },
            //style: "font-size:10px;position:relative;left:-90px",
            style: "position: relative; left: -20%",
        },
        {
            text: "Cancel",
            click: function(){
                $( "#credentials-modal-form" ).dialog( "close" );
            },
            //style: "font-size:10px;position:relative;left:0px",
            style: "position: relative; right: -10%",
        }
    ]
}); 
//End of Sign In modal form

//Call Transfer modal form
$( "#calltransfer-modal-form" ).dialog({
    autoOpen: false,
    modal: true,
    width: 150,
    height: 250,
    resizable: false,
    title: "Extensions",
    buttons: [
        {
            text: "Transfer",
            click: function(){
                transferCall();
            },
            style: "position: relative; left: 0%",
        },
        {
            text: "Cancel",
            click: function(){
                $( "#calltransfer-modal-form" ).dialog( "close" );
            },
            style: "position: relative; right: -10%",
        }
    ]
});

//until here Call Transfer modal form

//Sign out process will delete all localStorage variables and sign out the proxy
$('#signout').click(function(){
    console.log("Signing Out!");
    bwlogout(localStorage.getItem('username'));
});

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

$('#transfer').click(function(){
    event.preventDefault();
    getUserDir();
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

//auxiliary functions from here
saveCallLog = function (response) {
    var result = JSON.parse(response.result);
    localStorage.setItem('resultobjectid', result.objectId);
    $('#callwrapup').css('display', 'inline');
};

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

function getAuthorizationHeader() {
    var header = "Basic " + $.base64.encode($('#username').val() + ":" + $('#password').val());
    return header;
};
//to here