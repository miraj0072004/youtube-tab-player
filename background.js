console.log('BACKGROUND: Service worker started.');

// --- Playlist Reset Logic ---
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.storage.session.set({ playedTabs: [] });
  console.log('BACKGROUND: Playlist has been reset by user.');

  chrome.action.setBadgeText({ text: 'RST' });
  chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
});

// --- Main Player Logic ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'video_ended') {
    console.log('BACKGROUND: Received "video_ended" message from tab:', sender.tab.id, 'URL:', sender.tab.url);
    
    const findAndPlayNext = async () => {
      try {
        const data = await chrome.storage.session.get('playedTabs');
        let playedTabs = data.playedTabs || [];
        
        if (!playedTabs.includes(sender.tab.id)) {
          playedTabs.push(sender.tab.id);
        }
        await chrome.storage.session.set({ playedTabs: playedTabs });
        console.log('BACKGROUND: Played tabs are now:', playedTabs);

        // Query both regular YouTube videos and Shorts
        const watchTabs = await chrome.tabs.query({ url: "*://www.youtube.com/watch*" });
        const shortsTabs = await chrome.tabs.query({ url: "*://www.youtube.com/shorts/*" });
        
        const allTabs = [...watchTabs, ...shortsTabs];
        const uniqueTabIds = new Set();
        const uniqueTabs = allTabs.filter(tab => {
          if (uniqueTabIds.has(tab.id)) {
            return false;
          }
          uniqueTabIds.add(tab.id);
          return true;
        });

        const unplayedTabs = uniqueTabs.filter(tab => !playedTabs.includes(tab.id));
        console.log('BACKGROUND: Found unplayed tabs:', unplayedTabs.map(t => ({ id: t.id, url: t.url })));

        if (unplayedTabs.length === 0) {
          console.log('BACKGROUND: All videos have been played. Playlist complete.');
          return;
        }

        const nextTab = unplayedTabs[0];
        console.log(`BACKGROUND: Next tab to play is ID: ${nextTab.id}, URL: ${nextTab.url}`);
        
        await chrome.tabs.update(nextTab.id, { active: true });
        console.log(`BACKGROUND: Switched to tab ${nextTab.id}.`);
        await chrome.tabs.sendMessage(nextTab.id, { message: 'play_video' });
        console.log(`BACKGROUND: Sent "play_video" command to tab ${nextTab.id}.`);
      } catch (error) {
        console.error('BACKGROUND: An error occurred:', error);
      }
    };

    findAndPlayNext();
    return true; // Keep message channel open for async response
  }
});