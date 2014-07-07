$('document').ready(function(){
    $(document).tooltip();
    
    if(localStorage.getItem("loggedin") != "true" || !localStorage.getItem("loggedin")){
        $( "#credentials-modal-form" ).dialog( "open" );
    }else {
        issignedinserver(localStorage.getItem('username'), function(result){
            if(result == true){
                console.log('user is signed in');
                connect(localStorage.getItem("username"));
                $('#loggeduser').text(localStorage.getItem(('username')));
                $('#signout').css('display', 'inline');
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
        $('#show_hidedialpad').attr('id', 'dialpad_inactive');
    }else if(dialpaddisplay == 'inline'){
        $('#dialpad').css('display', 'inline');
        $('#show_hidedialpad').attr('id', 'dialpad_active');
    }

    //this is to maintain the status of the taking notes area
    var takingnotesdisplay = localStorage.getItem('takingnotes');
    if(takingnotesdisplay == 'true'){
        $('#takenotesform').css('display', 'inline');
    }else{
        $('#takenotesform').css('display', 'none');
    }

    //this is to maintain the status of the destination input field
    $('#destination').val(localStorage.getItem('destinationnumber'));
});

$('.digit').click(function(){
    var number = $(this).html();
    //$('#number').append(number);
    appenddestination(number);
    $('#destination').val(localStorage.getItem('destinationnumber'));
});

$('#clear').click(function(){
    //$('#number').empty();
    localStorage.setItem('destinationnumber', '');
    $('#destination').val(localStorage.getItem('destinationnumber'));
});

$('#delete').click(function(){
    //var text = $('#number').text();
    var text = $('#destination').val();
    text = text.slice(0, text.length-1);
    //$('#number').html(text);
    localStorage.setItem('destinationnumber', text);
    $('#destination').val(localStorage.getItem('destinationnumber'));
});

$('#show_hidedialpad').click(function(){
    var dialpaddisplay = $('#dialpad').css('display');
    if(dialpaddisplay == 'none'){
        $('#dialpad').css('display', 'inline');
        localStorage.setItem('dialpadstatus', 'inline');
        $(this).attr('id', 'dialpad_active');
    }else if(dialpaddisplay == 'inline'){
        $('#dialpad').css('display', 'none');
        localStorage.setItem('dialpadstatus', 'none');
        $(this).attr('id', 'dialpad_inactive');
    }
});

//modal dialog for when the main streaming HTTP connection is lost
$("#dialog_mainhttp_disconnection").dialog({
    autoOpen: false,
    resizable: false,
    height:140,
    width: 180,
    modal: true,
    title: "Server disconnection!",
    buttons: [
        {
            text: "Ok",
            click: function(){
                $(this).dialog('close');
                $( "#credentials-modal-form" ).dialog( "open" );
                $('#loggeduser').text('');
                $('#signout').css('display', 'none');
            },
            style: "position: relative; left: -20%",
        },
    ]
});
//end of modal dialog for when the main streaming HTTP connection is lost

//Sign In modal form
$( "#credentials-modal-form" ).dialog({
    autoOpen: false,
    modal: true,
    width: 180,
    resizable: false,
    //title: "BW Credentials",
    buttons: [
        {
            text: "Sign In",
            click: function(){
                bwlogin($('#username').val(), $('#password').val());
            },
            style: "position: relative; left: -100px",
        },
    ],
}); 
//End of Sign In modal form

//Call Transfer modal form
$( "#calltransfer-modal-form" ).dialog({
    autoOpen: false,
    modal: true,
    width: 180,
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

//call wrap-up modal form
$( "#wrapup-modal-form" ).dialog({
    autoOpen: false,
    modal: true,
    width: 180,
    height: 250,
    resizable: true,
    title: "Call Wrap-up",
    buttons: [
        {
            text: "Save",
            click: function(event){   
                event.preventDefault();
                var duedate = $('#duedatepicker').val();
                console.log("Duedate is: " + duedate);
                var subject = $('#subject').val();
                var callresult = $('#callresult').val();
                var priority = $('#priorities').val();
                var status = $('#status').val();
                //var comments = $('#comments').val();
                var comments = $('#takenotes').val();//take text from take notes area
                        
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
                        sforce.interaction.refreshPage(refreshsfdcpage_callback);
                    }else{
                        console.log("error in sforce.interaction.saveLog: " + response.error);
                    }
                });

                localStorage.removeItem('resultobjectid');
                localStorage.removeItem('takingnotes');
                $( "#wrapup-modal-form" ).dialog( "close" );
            },
            style: "position: relative; left: 0%",
        },
        {
            text: "Cancel",
            click: function(){
                $( "#wrapup-modal-form" ).dialog( "close" );
                localStorage.removeItem('takingnotes');
            },
            style: "position: relative; right: -10%",
        }
    ]
});
//until here call wrap-up modal form

//settings modal dialog
$( "#settings-modal-menu" ).dialog({
    autoOpen: false,
    modal: true,
    width: 180,
    resizable: false,
    title: "Settings",
    open: function(event, ui){
        var softphonestate = localStorage.getItem('softphonestate');
        if(softphonestate){
            $('#settings_status').text('signed in');
            $('#signin').css('display', 'none');
        }else{
            $('#settings_status').text('signed out');
            $('#signout').css('display', 'none');
            $('#signin').css('display', 'inline');
        }
    },
});
//until here setting modal dialog

$('#show_hidesettings').click(function(event){
    event.preventDefault();
    $("#settings-modal-menu").dialog('open');
});

//Take notes text area
$('#savenotes').click(function(event){
    event.preventDefault();
    //show the notes in the wrap up "comments" area as well);
    $('#comments').text($('#takenotes').val());

    sforce.interaction.getPageInfo(saveCallLog); //save call log in SFDC
    $('#takenotesform').css('display', 'none');
});

$('#cancelnotes').click(function(event){
    event.preventDefault();
    $('#takenotes').val('');
    $('#takenotesform').css('display', 'none');
    localStorage.removeItem('takingnotes');
});
//until here take notes text area

//Sign out process will delete all localStorage variables and sign out the proxy
$('#signout').click(function(){
    bwlogout(localStorage.getItem('username'));
});

$('#signin').click(function(){
    $( "#credentials-modal-form" ).dialog('open');
    $("#settings-modal-menu").dialog('close');
});

$('#notes').click(function(){
    $('#takenotesform').css('display', 'inline');
    localStorage.setItem('takingnotes', 'true');
    $("#settings-modal-menu").dialog('close');
});

$('#history').click(function(){
    var callhistoryaccordion = localStorage.getItem('callhistory');
    if(callhistoryaccordion == 'open'){
        $('#entry-accordion').accordion("disable");
        $('#usercalllog').css('display', 'none');
        localStorage.removeItem('callhistory');
    }else{
        getUserCallHistory();
    }
});

$( "#duedatepicker" ).datepicker({ dateFormat: "yy-mm-dd" });

$('#destination').keyup(function(e){
    if (e.keyCode == 13){
        $('#call').click();
    }
});

$('#call').click(function(event){
    event.preventDefault();
    var state = localStorage.getItem("softphonestate");
    switch(state){
        case 'free':
        case 'transferring_free':
            var destination = $('#destination').val();
            if(validatenumber(destination)){
                localStorage.setItem('destinationnumber', destination);
                makecall(destination);
            }else{
                alert('Destination number with wrong format');
                localStorage.setItem('destinationnumber', '');
                $('#destination').val('');
            }
            break;
        case 'transferring':
            if(!localStorage.getItem('callId')){
                disconnectcall(localStorage.getItem('callId2'));
            }
            localStorage.setItem('softphonestate', 'busy');
            break;
        case 'busy':
        case 'outgoingcall':
            disconnectcall(localStorage.getItem('callId'));
            break;   
        case 'incomingcall':
            acceptcall();
            break;
        default:
    } 
});

$('#transfer').click(function(event){
    event.preventDefault();
    //getUserDir(); -> this should be called when the HeldEvent is received and the state is
    //transferring
    var softphonestate = localStorage.getItem('softphonestate');
    switch(softphonestate){
        case 'transferring':
            retrieveCall(localStorage.getItem('callId'));
            break;
        case 'transferring_calling':
            localStorage.setItem('softphonestate', 'transferring');
            retrieveCall(localStorage.getItem('callId'));
            break;
        case 'transferring_consulting':
            consultTransfer();
            break;
        case 'held':
        case 'transferring_free':
            retrieveCall(localStorage.getItem('callId'));
            break;
        case 'busy':
            localStorage.setItem('softphonestate', 'transferring');
            holdCall(localStorage.getItem('callId'));
            break;
        default:
    }
});

$('#address').click(function(event){
    event.preventDefault();
    getUserDir();
});

$('#hold').click(function(event){
    event.preventDefault();
    var softphonestate = localStorage.getItem('softphonestate');
    if(softphonestate == 'busy'){
        holdCall(localStorage.getItem('callId'));
    }else if(softphonestate == 'held'){
        retrieveCall(localStorage.getItem('callId'));
    }
});

$('#declinecall').click(function(event){
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
validatenumber = function(number){
    var regexp = /([0-9]{4})|(((0[7-9]0)|(0[1-9]))(-)?([0-9]{4})(-)?([0-9]{4}))/;
    if(regexp.test(number)){
        return true;
    }else{
        return false;
    }
};

appenddestination = function(digit){
    var dest = localStorage.getItem('destinationnumber');
    dest = dest + digit;
    localStorage.setItem('destinationnumber', dest);
};

saveCallLog = function (response) {
    var result = JSON.parse(response.result);
    localStorage.setItem('resultobjectid', result.objectId);
    $( "#wrapup-modal-form" ).dialog('open');
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
        var softphonestate = localStorage.getItem('softphonestate');
        if(softphonestate == "incomingcall" || softphonestate == 'outgoingcall'){
            $('.pulse').effect('pulsate');
            pulseCallButton();
        }
    }, 3000);
};

releaseLocalStorage = function(){
    localStorage.removeItem('callEndTime');
    localStorage.removeItem('callNumber');
    localStorage.removeItem('callStartTime');
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

refreshsfdcpage_callback = function(response){
    if(response.result){
        console.log("Page refresh has been invoked");
    }else{
        console.log("Page refreseh has NOT been invoked");
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