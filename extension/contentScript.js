
var myOwnData = "createdFromContentScript";
var myScript = document.createElement("script");
myScript.innerHTML = `
let store = document.querySelectorAll('.background-container')[0]._reactRootContainer._internalRoot.current.child.pendingProps.store;

//store.subscribe(()=> window.postMessage(JSON.stringify({state: store.getState()})));

window.actions = [];

let originalDispatch = store.dispatch;
store.dispatch = action => {
    window.postMessage(JSON.stringify({action: action, idx: actions.length}));
    //actions.push(JSON.parse(JSON.stringify(action)));

    return originalDispatch(action);
};

window.addEventListener("message", e => {
    let msg = null;
    try {
        msg = JSON.parse(e.data);
    } catch (e) {
        return;
    }
    if (msg.dispatch) {
        console.warn("Remote dispatch:", msg.dispatch);
        originalDispatch(msg.dispatch);
    }
});

`;
document.body.appendChild(myScript);

let excludeActionTypes = [
    'ui/player/playerMedia/tickPlayer'
];

let sendActionTypes = [
    'ui/player/playerMedia/togglePlayPause',
    'ui/player/playerMedia/seek',
    'ui/player/playerLifecycle/startPlayback',
    'ui/player/playerLifecycle/endPlayback',
    'metadata/redispatchLegacyMetadataAction'
];


let ws = null;

let wsHost = null;
let wsRoom = null;
let wsName = null;

var port = chrome.runtime.connect({name: "contentScript"});

port.onMessage.addListener(function(msg) {
  if ('setHost' in msg) {
      wsHost = msg.setHost;
  }
  if ('setRoom' in msg) {
      wsRoom = msg.setRoom;
  }
  if ('setName' in msg) {
      wsName = msg.setName;
  }
  if (msg.disconnect) {
      disconnect();
  }
  if (msg.connect) {
      connect();
  }
  if (msg.endPlayback) {
      let action = {type:"ui/player/playerLifecycle/endPlayback",payload:{playerType:"audioVideo"}};
      window.postMessage(JSON.stringify({dispatch: action}));
      if (ws) {
          ws.send(JSON.stringify({action: action}));
      }
  }
  if (msg.resetPlayback) {
      let action1 = {type:"ui/player/playerMedia/togglePlayPause", payload:{playerType: "audioVideo", shouldPause: true}};
      let action2 = {type:"ui/player/playerMedia/seek", payload:{playerType: "audioVideo", positionSeconds: 0}};
      window.postMessage(JSON.stringify({dispatch: action1}));
      window.postMessage(JSON.stringify({dispatch: action2}));
      if (ws) {
          ws.send(JSON.stringify({action: action1}));
          ws.send(JSON.stringify({action: action2}));
      }
  }
});

let disconnect = function() {
    if (ws) {
        ws.close();
        ws = null;
        port.postMessage({message: "Disconnected", connected: false, roomStatus: null});
    }
}

let connect = function() {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (!wsHost || !wsRoom || !wsName) {
        port.postMessage({message: "Must set host, room, and name before connecting.", error: true})
        return;
    }

    port.postMessage({message: "Connecting"});

    console.log("Connecting to", wsHost);

    ws = new WebSocket("wss://" + wsHost + "/");

    ws.addEventListener("message", e => {
        let msg = JSON.parse(e.data);
        if (msg.dispatch) {
            window.postMessage(e.data);
        } else if (msg.navigate) {
            window.location.href=msg.navigate
        } else if (msg.roomStatus) {
            console.log("Got new room status:", msg.roomStatus);
            port.postMessage(msg);
        }
    });

    ws.addEventListener("open", e => {
        if (wsRoom) {
            ws.send(JSON.stringify({joinRoom: wsRoom}));
        }
        if (wsName) {
            ws.send(JSON.stringify({setName: wsName}));
        }
        port.postMessage({message: "Connected", connected: true});
    });

    ws.addEventListener("error", (e,f) => {
        port.postMessage({message: e.data || ("Error connecting to " + ws.url), error: true});
    })

}


window.addEventListener("hashchange", e => {
    let url = e.newURL;
    console.log("HASH CHANGE", url);
    if (ws) {
        ws.send(JSON.stringify({url: e.newURL}));
    }
});


window.addEventListener("message", e => {
    let msg = null
    try {
        msg = JSON.parse(e.data);
    } catch (e) {
        return;
    }

    if (msg.state) {
        //console.warn(msg.state.ui.audioVideoPlayer.positionSeconds);
        //if (msg.state.ui.audioVideoPlayer.playQueue) {
        //    console.warn(msg.state.ui.audioVideoPlayer.playQueue.playQueueSelectedMetadataItemID);
        //}
    } else if (msg.action) {
        if (excludeActionTypes.indexOf(msg.action.type) > -1)
            return
          

        console.warn("Action:", msg.idx, msg.action);

        if (sendActionTypes.indexOf(msg.action.type) > -1 && ws) {
            console.warn("Sending action:", msg.action);
            ws.send(JSON.stringify({action: msg.action}));
        }
    }

})

port.postMessage({loaded: true});

// ui/player/playerLifecycle/startPlayback


// CONTROL
// {type:"ui/player/playerMedia/togglePlayPause",payload:{playerType:"audioVideo",shouldPlay:true}}
// {type:"ui/player/playerMedia/seek",payload:{playerType:"audioVideo",positionSeconds: 423}}
// {type:"ui/player/playerLifecycle/endPlayback",payload:{playerType:"audioVideo"}}

// READ
// {type:"ui/player/playerMedia/updatePlayerPosition",payload:{playerType:"audioVideo",positionSeconds: 423}}
// {type:"app/navigate", ...? }


// Start playback with partial progress
// "{"type":"ui/player/playerLifecycle/startPlayback","payload":{"serverEntityID":"servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272","providerEntityID":"providers--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--com.plexapp.plugins.library","itemServerEntityID":"servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272","itemProviderEntityID":"providers--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--com.plexapp.plugins.library","metadataItemEntityID":"metadataItems--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--/library/metadata/27112","metricsPage":"preplay","metricsProperties":{"identifier":"com.plexapp.plugins.library"},"options":{}}}"
// If this has been partially played before, the "resume or restart dialog appears, which then dispatches:"
// {"type":"ui/player/playerLifecycle/startPlayback","payload":{"serverEntityID":"servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272","providerEntityID":"providers--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--com.plexapp.plugins.library","itemServerEntityID":"servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272","itemProviderEntityID":"providers--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--com.plexapp.plugins.library","metadataItemEntityID":"metadataItems--servers--b5a8ea0ce869afa0176afc352266bacd2d5f8272--/library/metadata/27112","metricsPage":"preplay","metricsProperties":{"identifier":"com.plexapp.plugins.library"},"options":{},"extrasPrefixCount":0,"openState":"full","isPaused":false,"confirmPlayback":true,"confirmOffset":true,"startOffsetMilliseconds":720000}}


