let notLoaded = $("#notLoaded");
let loaded = $("#loaded");

let host = $('#host');
let room = $('#room');
let name = $('#name');

let params = $("#params");

let connect = $('#connect');
let disconnect = $('#disconnect');

let connected = $("#connected");

let roomStatus = $("#roomStatus");
let members = $("#roomMembers");

let endPlayback = $("#endPlayback")

let messages = $("#messages");

let port = chrome.runtime.connect({name: "popup"});

let updateStatus = function(status) {
  if (status.connected) {
    connect.hide();
    connected.show();
    disconnect.show();
    params.hide();
    endPlayback.show();
  } else {
    connect.show();
    connected.hide();
    disconnect.hide();
    params.show();
    endPlayback.hide();
  }

  if (status.pageLoaded) {
    notLoaded.hide();
    loaded.show();
  } else {
    notLoaded.show();
    loaded.hide();
  }

  if (status.room) {
    roomStatus.show();
    members.empty();
    for(let i = 0; i < (status.room.members || []).length; i++) {
      members.append(
        $('<li>').text(status.room.members[i])
      );
    }
  } else {
    roomStatus.hide();
  }
}

let updateParams = function(params) {
  host.val(params.host);
  room.val(params.room);
  name.val(params.name);
  $(".roomName").text(params.room);
}

let updateMessages = function(msgs) {
  messages.empty();

  let displayCount = 0;
  for(let i = msgs.length - 1; i >= 0; i--) {
    if (displayCount > 5) {
      break;
    }

    messages.prepend(
      $('<li>').text(msgs[i].message).toggleClass("error", msgs[i].error===true)
    );

    displayCount++
  }
}

port.onMessage.addListener(function(msg) {
  console.log("Popup message:", msg);
  if (msg.status) {
    updateStatus(msg.status);
  }
  if (msg.params) {
    updateParams(msg.params);
  }
  if (msg.messages) {
    updateMessages(msg.messages);
  }
});

connect.on("click", function() {
  $(".roomName").text(room.val());
  port.postMessage({
    setHost: host.val(),
    setRoom: room.val(),
    setName: name.val(),
    connect: true,
  });
});

disconnect.on("click", function() {
  port.postMessage({
    disconnect: true,
  });
});

endPlayback.on("click", function() {
  port.postMessage({
    endPlayback: true,
  });
});

port.postMessage({getParams: true, getStatus: true});