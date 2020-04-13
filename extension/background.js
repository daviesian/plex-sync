chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({host: 'plex-sync.iandavies.org'});

    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
          conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'app.plex.tv'},
          })
          ],
              actions: [new chrome.declarativeContent.ShowPageAction()]
        }]);
      });
  });


let contentScriptPort = null;
let popupPort = null;
let initialStatus = {
  pageLoaded: false,
  connected: false,
  room: null,
};
let status = JSON.parse(JSON.stringify(initialStatus));
let messages = [];

chrome.runtime.onConnect.addListener(function(port) {

  switch(port.name) {
    case "contentScript":
      console.log("Content script connected:", port)
      port.onMessage.addListener(function(msg) {
        console.log("Message from content script:", msg);
        
        if ('connected' in msg) {
          status.connected = msg.connected;
        }
        if ('roomStatus' in msg) {
          status.room = msg.roomStatus;
        }
        if ('loaded' in msg) {
          status.pageLoaded = true;
        }
        if ('message' in msg || 'error' in msg) {
          messages.push(msg);
        }

        if (popupPort) {
          popupPort.postMessage({status: status, messages: messages});
        }
      });
      port.onDisconnect.addListener(function() {
        status = JSON.parse(JSON.stringify(initialStatus));
        contentScriptPort = null;
      })
      contentScriptPort = port;
      break;

    case "popup":
      console.log("Popup script connected:", port);

      port.onMessage.addListener(function(msg) {
        console.log("Message from popup script:", msg);

        if (msg.getParams) {
          chrome.storage.sync.get(null, function(params) {
            port.postMessage({params: params});
          });
        }
        if (msg.getStatus) {
          port.postMessage({status: status, messages: messages});
        }

        if ('setHost' in msg) {
          chrome.storage.sync.set({host: msg.setHost});
        }
        if ('setRoom' in msg) {
          chrome.storage.sync.set({room: msg.setRoom});
        }
        if ('setName' in msg) {
          chrome.storage.sync.set({name: msg.setName});
        }

        if (contentScriptPort) {
          contentScriptPort.postMessage(msg);
        }
      });
      port.onDisconnect.addListener(function() {
        popupPort = null;
      });
      popupPort = port;
      break;
  }
});