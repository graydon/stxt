chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'bounds': {
      'width': 400,
      'height': 500
    }
  });

  chrome.app.window.create('test/test.html', {
    'bounds': {
      'width': 400,
      'height': 500
    }
  });

});
