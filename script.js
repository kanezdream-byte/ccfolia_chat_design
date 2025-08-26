let chatData = null;
let originalChatData = null;
let nameMapping = {};
let originalNameMapping = {};
let addMessagePanels = {};
let selectedText = null;
let selectedRange = null;
let currentEditingElement = null;
let currentPage = 1;
let totalPages = 1;

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                chatData = JSON.parse(event.target.result);
                originalChatData = JSON.parse(event.target.result); // Keep original copy
                
                // Update file status
                const fileStatus = document.getElementById('fileStatus');
                fileStatus.classList.add('active');
                fileStatus.textContent = `✅ ${file.name} 로드 완료`;
                
                // Update stats
                const statsGrid = document.getElementById('statsGrid');
                statsGrid.style.display = 'grid';
                
                document.getElementById('totalMessages').textContent = chatData.messages.length;
                
                // Count unique characters and create name mapping
                const uniqueCharacters = [...new Set(chatData.messages
                    .filter(m => m.characterName !== 'Unknown' && m.characterName !== 'PL 웃')
                    .map(m => m.characterName))];
                document.getElementById('totalCharacters').textContent = uniqueCharacters.length;
                
                // Create name change controls
                createNameChangeControls(uniqueCharacters);
                
                // Reset pagination when new file is loaded
                resetPagination();
                renderMessages();
            } catch (error) {
                alert('JSON 파일을 읽을 수 없습니다.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }
});

function createNameChangeControls(characters) {
    const container = document.getElementById('nameChangeList');
    container.innerHTML = '';
    
    characters.forEach(char => {
        const item = document.createElement('div');
        item.className = 'name-change-item';
        item.innerHTML = `
            <div class="original-name" title="${char}">${char}</div>
            <span>→</span>
            <input type="text" 
                   placeholder="새 이름" 
                   data-original="${char}"
                   value="${nameMapping[char] || ''}"
                   onchange="updateNameMapping(this)">
        `;
        container.appendChild(item);
    });
    
    // Initialize name mapping
    characters.forEach(char => {
        if (!nameMapping[char]) {
            originalNameMapping[char] = char;
        }
    });
}

function updateNameMapping(input) {
    const original = input.dataset.original;
    const newName = input.value.trim();
    
    if (newName) {
        nameMapping[original] = newName;
    } else {
        delete nameMapping[original];
    }
    
    // Apply name changes to data
    applyNameChanges();
    renderMessages();
}

function applyNameChanges() {
    if (!originalChatData) return;
    
    // Reset to original data first
    chatData = JSON.parse(JSON.stringify(originalChatData));
    
    // Apply name mappings
    chatData.messages.forEach(msg => {
        if (nameMapping[msg.characterName]) {
            msg.characterName = nameMapping[msg.characterName];
        }
    });
}

function resetNames() {
    nameMapping = {};
    
    // Reset all inputs
    const inputs = document.querySelectorAll('#nameChangeList input');
    inputs.forEach(input => {
        input.value = '';
    });
    
    // Reset data
    if (originalChatData) {
        chatData = JSON.parse(JSON.stringify(originalChatData));
        renderMessages();
    }
}

function deleteMessage(index) {
    if (chatData && chatData.messages) {
        chatData.messages.splice(index, 1);
        
        // Check if current page is still valid after deletion
        const limit = parseInt(document.getElementById('messageLimit').value);
        const newTotalPages = Math.ceil(chatData.messages.length / limit);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            currentPage = newTotalPages;
        }
        
        renderMessages();
        
        // Update stats
        document.getElementById('totalMessages').textContent = chatData.messages.length;
    }
}

function duplicateMessage(index) {
    if (chatData && chatData.messages) {
        const messageToDuplicate = JSON.parse(JSON.stringify(chatData.messages[index]));
        chatData.messages.splice(index + 1, 0, messageToDuplicate);
        renderMessages();
        
        // Update stats
        document.getElementById('totalMessages').textContent = chatData.messages.length;
    }
}

function showAddMessagePanel(index) {
    const panelId = `add-panel-${index}`;
    addMessagePanels[panelId] = true;
    renderMessages();
}

function hideAddMessagePanel(index) {
    const panelId = `add-panel-${index}`;
    delete addMessagePanels[panelId];
    renderMessages();
}

function addNewMessage(index, type) {
    const nameInput = document.getElementById(`add-name-${index}`);
    const contentInput = document.getElementById(`add-content-${index}`);
    
    const newMessage = {
        id: Date.now(),
        characterName: type === 'system' ? 'Unknown' : (nameInput.value.trim() || '새 캐릭터'),
        content: contentInput.value.trim() || '새 메시지',
        time: new Date().toLocaleString(),
        nameColor: type === 'system' ? 'rgb(158, 158, 158)' : 'rgb(107, 166, 255)',
        timestamp: Date.now()
    };
    
    if (type === 'character') {
        // Get unique characters for avatar
        const uniqueChars = [...new Set(chatData.messages
            .filter(m => m.characterName !== 'Unknown' && m.characterName !== 'PL 웃')
            .map(m => m.characterName))];
        
        // Copy avatar from existing character if name matches
        const existingChar = chatData.messages.find(m => m.characterName === newMessage.characterName);
        if (existingChar && existingChar.avatar) {
            newMessage.avatar = existingChar.avatar;
        }
    }
    
    chatData.messages.splice(index + 1, 0, newMessage);
    hideAddMessagePanel(index);
    
    // Update stats
    document.getElementById('totalMessages').textContent = chatData.messages.length;
}

document.getElementById('theme').addEventListener('change', updatePreviewBadge);
document.getElementById('aspectRatio').addEventListener('change', applySettings);
document.getElementById('fontSize').addEventListener('change', applySettings);
document.getElementById('avatarSize').addEventListener('change', applySettings);
document.getElementById('showTimestamp').addEventListener('change', applySettings);
document.getElementById('messageLimit').addEventListener('change', function() {
    resetPagination();
    renderMessages();
});

function updatePreviewBadge() {
    const theme = document.getElementById('theme').value;
    const badge = document.getElementById('previewBadge');
    const themeNames = {
        'cocofolia': '테마: 코코포리아',
        'discord': '테마: 디스코드',
        'twitter': '테마: 트위터'
    };
    badge.textContent = themeNames[theme];
}

function applySettings() {
    const theme = document.getElementById('theme').value;
    const aspectRatio = document.getElementById('aspectRatio').value;
    const fontSize = document.getElementById('fontSize').value;
    const avatarSize = document.getElementById('avatarSize').value;
    const showTimestamp = document.getElementById('showTimestamp').checked;
    const autoFitContent = document.getElementById('autoFitContent').checked;
    const autoFitWidth = document.getElementById('autoFitWidth').value;
    const container = document.getElementById('chatContainer');
    const previewContainer = container.closest('.preview-container');
    
    // Remove all theme, aspect ratio, font size, avatar size, and timestamp classes
    container.className = container.className.replace(/theme-\S+/g, '');
    container.className = container.className.replace(/aspect-\S+/g, '');
    container.className = container.className.replace(/font-\S+/g, '');
    container.className = container.className.replace(/avatar-\S+/g, '');
    container.classList.remove('hide-timestamp');
    container.classList.remove('auto-fit-content');
    container.classList.remove('custom-width');
    previewContainer.classList.remove('auto-fit-mode');
    previewContainer.classList.remove('custom-width');
    
    // Add new classes
    container.classList.add('chat-container');
    container.classList.add(`theme-${theme}`);
    container.classList.add(`font-${fontSize}`);
    container.classList.add(`avatar-${avatarSize}`);
    
    // Add timestamp visibility class
    if (!showTimestamp) {
        container.classList.add('hide-timestamp');
    }
    
    // Show/hide auto-fit width section
    const autoFitWidthSection = document.getElementById('autoFitWidthSection');
    if (autoFitContent) {
        autoFitWidthSection.style.display = 'block';
    } else {
        autoFitWidthSection.style.display = 'none';
    }
    
    // Apply auto-fit or aspect ratio
    if (autoFitContent) {
        // Auto-fit mode: show all messages without scrolling
        container.classList.add('auto-fit-content');
        previewContainer.classList.add('auto-fit-mode');
        
        // Apply custom width if specified
        if (autoFitWidth && autoFitWidth > 0) {
            container.classList.add('custom-width');
            previewContainer.classList.add('custom-width');
            container.style.setProperty('--custom-width', autoFitWidth + 'px');
        }
        
        // Disable aspect ratio select when auto-fit is on
        document.getElementById('aspectRatio').disabled = true;
    } else {
        // Normal aspect ratio mode
        container.classList.add(`aspect-${aspectRatio}`);
        document.getElementById('aspectRatio').disabled = false;
        
        // Manage preview container class for aspect modes
        if (aspectRatio === 'full') {
            previewContainer.classList.remove('aspect-mode');
        } else {
            previewContainer.classList.add('aspect-mode');
        }
    }
    
    updatePreviewBadge();
    renderMessages();
}

function makeEditableWithFormatting(element, messageIndex, field) {
    element.contentEditable = true;
    element.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Save original value
    const originalValue = element.textContent;
    
    // Handle blur (save)
    element.onblur = function() {
        element.contentEditable = false;
        let newValue = element.textContent.trim();
        
        // Remove '[편집 완료]' text automatically
        newValue = newValue.replace(/\[편집\s*완료\]/gi, '').trim();
        
        if (newValue !== originalValue && chatData) {
            // Handle nested properties like 'colorBlocks.0.content'
            if (field.includes('.')) {
                const fieldParts = field.split('.');
                let target = chatData.messages[messageIndex];
                
                for (let i = 0; i < fieldParts.length - 1; i++) {
                    if (!target[fieldParts[i]]) {
                        target[fieldParts[i]] = {};
                    }
                    target = target[fieldParts[i]];
                }
                
                target[fieldParts[fieldParts.length - 1]] = newValue;
            } else {
                chatData.messages[messageIndex][field] = newValue;
            }
            // Update the display without re-rendering
            element.textContent = newValue;
        }
    };
    
    // Handle enter key
    element.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        }
        // Prevent newlines in names
        if (field === 'characterName' && e.key === 'Enter') {
            e.preventDefault();
        }
    };
}

function renderMessages() {
    if (!chatData) {
        updatePaginationInfo();
        return;
    }
    
    const container = document.getElementById('chatContainer');
    const theme = document.getElementById('theme').value;
    const limit = parseInt(document.getElementById('messageLimit').value);
    
    // Update pagination info
    updatePaginationInfo();
    
    container.innerHTML = '';
    
    
    // Calculate which messages to show based on current page
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const messagesToShow = chatData.messages.slice(startIndex, endIndex);
    
    messagesToShow.forEach((msg, relativeIndex) => {
        const actualIndex = startIndex + relativeIndex; // Real index in the full messages array
        
        // Add message panel if active
        const panelId = `add-panel-${actualIndex}`;
        if (addMessagePanels[panelId]) {
            const addPanel = document.createElement('div');
            addPanel.className = 'add-message-panel active';
            addPanel.innerHTML = `
                <div class="add-message-controls">
                    <div class="add-message-type ${msg.characterName !== 'Unknown' ? 'selected' : ''}" 
                         onclick="this.classList.add('selected'); this.nextElementSibling.classList.remove('selected'); document.getElementById('add-name-${actualIndex}').disabled = false;">
                        👤 캐릭터 메시지
                    </div>
                    <div class="add-message-type ${msg.characterName === 'Unknown' ? 'selected' : ''}"
                         onclick="this.classList.add('selected'); this.previousElementSibling.classList.remove('selected'); document.getElementById('add-name-${actualIndex}').disabled = true; document.getElementById('add-name-${actualIndex}').value = 'Unknown';">
                        📢 시스템 메시지
                    </div>
                </div>
                <div class="add-message-form">
                    <input type="text" id="add-name-${actualIndex}" placeholder="캐릭터 이름" value="${msg.characterName !== 'Unknown' ? msg.characterName : ''}" ${msg.characterName === 'Unknown' ? 'disabled' : ''}>
                    <textarea id="add-content-${actualIndex}" placeholder="메시지 내용"></textarea>
                    <div class="add-message-actions">
                        <button class="btn-primary" onclick="addNewMessage(${actualIndex}, document.getElementById('add-name-${actualIndex}').disabled ? 'system' : 'character')">추가</button>
                        <button class="btn-secondary" onclick="hideAddMessagePanel(${actualIndex})">취소</button>
                    </div>
                </div>
            `;
            container.appendChild(addPanel);
        }
        
        if (msg.characterName === 'Unknown' || msg.characterName === 'PL 웃') {
            // System message
            const systemMsg = document.createElement('div');
            systemMsg.className = 'system-message';
            systemMsg.innerHTML = `
                <span class="editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'content')">${msg.content}</span>
                <div class="message-controls">
                    <button class="message-control-btn move-up" onclick="moveMessageUp(${actualIndex})" title="위로 이동" ${actualIndex === 0 ? 'disabled' : ''}>↑</button>
                    <button class="message-control-btn move-down" onclick="moveMessageDown(${actualIndex})" title="아래로 이동" ${actualIndex === chatData.messages.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="message-control-btn add" onclick="showAddMessagePanel(${actualIndex})" title="메시지 추가">+</button>
                    <button class="message-control-btn duplicate" onclick="duplicateMessage(${actualIndex})" title="복제">⧉</button>
                    <button class="message-control-btn delete" onclick="deleteMessage(${actualIndex})" title="삭제">×</button>
                </div>
            `;
            container.appendChild(systemMsg);
        } else {
            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            
            // Check if avatar image exists, otherwise use first letter
            let avatarContent;
            if (msg.avatar && msg.avatar !== 'https://ccfolia.com/blank.gif') {
                avatarContent = `<img src="${msg.avatar}" alt="${msg.characterName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatarContent = msg.characterName[0] || '?';
            }
            
            const messageControls = `
                <div class="message-controls">
                    <button class="message-control-btn move-up" onclick="moveMessageUp(${actualIndex})" title="위로 이동" ${actualIndex === 0 ? 'disabled' : ''}>↑</button>
                    <button class="message-control-btn move-down" onclick="moveMessageDown(${actualIndex})" title="아래로 이동" ${actualIndex === chatData.messages.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="message-control-btn add" onclick="showAddMessagePanel(${actualIndex})" title="메시지 추가">+</button>
                    <button class="message-control-btn duplicate" onclick="duplicateMessage(${actualIndex})" title="복제">⧉</button>
                    <button class="message-control-btn add-block" onclick="addColorBlock(${actualIndex})" title="단색 블럭 추가" style="background: #e8f5e9; color: #2e7d32;">■</button>
                    <button class="message-control-btn delete" onclick="deleteMessage(${actualIndex})" title="삭제">×</button>
                </div>
            `;
            
            if (theme === 'cocofolia') {
                messageEl.innerHTML = `
                    <div class="avatar">${avatarContent}</div>
                    <div class="message-content">
                        <div class="character-name editable-text" style="color: ${msg.nameColor}" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'characterName')">${msg.characterName}</div>
                        <div class="message-text editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'content')">${msg.content}</div>
                        <div class="timestamp">${msg.time}</div>
                    </div>
                    ${messageControls}
                `;
            } else if (theme === 'discord') {
                messageEl.innerHTML = `
                    <div class="avatar">${avatarContent}</div>
                    <div class="message-content">
                        <div>
                            <span class="character-name editable-text" style="color: ${msg.nameColor}" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'characterName')">${msg.characterName}</span>
                            <span class="timestamp">${msg.time}</span>
                        </div>
                        <div class="message-text editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'content')">${msg.content}</div>
                    </div>
                    ${messageControls}
                `;
            } else if (theme === 'twitter') {
                messageEl.innerHTML = `
                    <div class="avatar">${avatarContent}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="character-name editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'characterName')">${msg.characterName}</span>
                            <span class="timestamp">${msg.time}</span>
                        </div>
                        <div class="message-text editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'content')">${msg.content}</div>
                    </div>
                    ${messageControls}
                `;
            }
            
            container.appendChild(messageEl);
        
        // Add solid color blocks if they exist for this message
        if (msg.colorBlocks && msg.colorBlocks.length > 0) {
            msg.colorBlocks.forEach((block, blockIndex) => {
                const blockEl = document.createElement('div');
                blockEl.className = 'solid-color-block';
                blockEl.style.backgroundColor = block.color;
                blockEl.style.opacity = block.opacity || 0.8;
                blockEl.innerHTML = `
                    <div class="editable-text" onclick="makeEditableWithFormatting(this, ${actualIndex}, 'colorBlocks.${blockIndex}.content')" style="position: relative; z-index: 2;">${block.content || '단색 블럭입니다. 클릭해서 편집하세요.'}</div>
                    <div class="block-controls">
                        <button class="block-control-btn delete" onclick="deleteColorBlock(${actualIndex}, ${blockIndex})" title="블럭 삭제">×</button>
                    </div>
                `;
                container.appendChild(blockEl);
            });
        }
        }
    });
    
    
    // Hide notice after a few seconds
    setTimeout(() => {
        const noticeEl = container.querySelector('.edit-mode-notice');
        if (noticeEl) {
            noticeEl.classList.remove('active');
        }
    }, 3000);
}

async function copyToClipboard() {
    const container = document.getElementById('chatContainer');
    const copyButton = document.querySelector('[onclick="copyToClipboard()"]');
    const autoFitEnabled = document.getElementById('autoFitContent').checked;
    
    try {
        // Hide edit controls
        const notice = container.querySelector('.edit-mode-notice');
        const controls = container.querySelectorAll('.message-controls, .block-controls');
        const addPanels = container.querySelectorAll('.add-message-panel');
        
        if (notice) notice.style.display = 'none';
        controls.forEach(c => c.style.display = 'none');
        addPanels.forEach(p => p.style.display = 'none');
        
        // 촬영할 정확한 영역 계산
        let targetElement = container;
        let canvasOptions = {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        };
        
        if (autoFitEnabled) {
            // 자동 맞춤 모드에서는 실제 콘텐츠 높이만 촬영
            const messages = container.querySelectorAll('.message, .system-message');
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                const containerRect = container.getBoundingClientRect();
                const lastMessageRect = lastMessage.getBoundingClientRect();
                const contentHeight = lastMessageRect.bottom - containerRect.top + 20; // 20px 여백
                
                canvasOptions.height = contentHeight;
                canvasOptions.windowHeight = contentHeight;
            }
        }
        
        // Create canvas and convert to blob
        const canvas = await html2canvas(targetElement, canvasOptions);
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        // Copy to clipboard
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);
        
        // Show success feedback
        const originalText = copyButton.textContent;
        const originalBg = copyButton.style.background;
        copyButton.textContent = '✅ 복사됨!';
        copyButton.style.background = 'linear-gradient(135deg, #28a745 0%, #218838 100%)';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.background = originalBg;
        }, 2000);
        
        // Restore visibility
        if (notice) notice.style.display = '';
        controls.forEach(c => c.style.display = '');
        addPanels.forEach(p => p.style.display = '');
        
    } catch (error) {
        console.error('클립보드 복사 실패:', error);
        alert('클립보드 복사에 실패했습니다.');
        
        // Restore visibility
        const notice = container.querySelector('.edit-mode-notice');
        const controls = container.querySelectorAll('.message-controls, .block-controls');
        const addPanels = container.querySelectorAll('.add-message-panel');
        
        if (notice) notice.style.display = '';
        controls.forEach(c => c.style.display = '');
        addPanels.forEach(p => p.style.display = '');
    }
}

function downloadAsImage() {
    const container = document.getElementById('chatContainer');
    const autoFitEnabled = document.getElementById('autoFitContent').checked;
    
    // Hide edit controls
    const notice = container.querySelector('.edit-mode-notice');
    const controls = container.querySelectorAll('.message-controls, .block-controls');
    const addPanels = container.querySelectorAll('.add-message-panel');
    
    if (notice) notice.style.display = 'none';
    controls.forEach(c => c.style.display = 'none');
    addPanels.forEach(p => p.style.display = 'none');
    
    let targetElement = container;
    let canvasOptions = {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true
    };
    
    if (autoFitEnabled) {
        // 자동 맞춤 모드에서는 실제 콘텐츠 높이만 촬영
        const messages = container.querySelectorAll('.message, .system-message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const containerRect = container.getBoundingClientRect();
            const lastMessageRect = lastMessage.getBoundingClientRect();
            const contentHeight = lastMessageRect.bottom - containerRect.top + 20; // 20px 여백
            
            canvasOptions.height = contentHeight;
            canvasOptions.windowHeight = contentHeight;
        }
    }
    
    html2canvas(targetElement, canvasOptions).then(canvas => {
        const link = document.createElement('a');
        link.download = `trpg-chat-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        // Restore visibility
        if (notice) notice.style.display = '';
        controls.forEach(c => c.style.display = '');
        addPanels.forEach(p => p.style.display = '');
    });
}


// Text Formatting Functions
function showFormatToolbar(x, y) {
    const toolbar = document.getElementById('formatToolbar');
    toolbar.style.left = x + 'px';
    toolbar.style.top = (y - 50) + 'px';
    toolbar.classList.add('active');
}

function hideFormatToolbar() {
    const toolbar = document.getElementById('formatToolbar');
    toolbar.classList.remove('active');
}

function applyFormat(type) {
    if (!selectedRange || !currentEditingElement) return;

    const selection = window.getSelection();
    const selectedText = selectedRange.toString();
    
    if (selectedText.length === 0) return;

    // Create a span element with the appropriate class
    const span = document.createElement('span');
    span.className = `text-${type}`;
    span.textContent = selectedText;

    // Replace the selected text with the formatted span
    selectedRange.deleteContents();
    selectedRange.insertNode(span);

    // Clear selection and hide toolbar
    selection.removeAllRanges();
    hideFormatToolbar();
    
    // Update the chat data
    updateChatDataFromElement(currentEditingElement);
}

function applyColorFormat(color) {
    if (!selectedRange || !currentEditingElement) return;

    const selection = window.getSelection();
    const selectedText = selectedRange.toString();
    
    if (selectedText.length === 0) return;

    // Create a span element with the color style
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = selectedText;

    // Replace the selected text with the colored span
    selectedRange.deleteContents();
    selectedRange.insertNode(span);

    // Clear selection and hide toolbar
    selection.removeAllRanges();
    hideFormatToolbar();
    
    // Update the chat data
    updateChatDataFromElement(currentEditingElement);
}

function clearFormat() {
    if (!selectedRange || !currentEditingElement) return;

    const selection = window.getSelection();
    const selectedText = selectedRange.toString();
    
    if (selectedText.length === 0) return;

    // Replace with plain text
    const textNode = document.createTextNode(selectedText);
    selectedRange.deleteContents();
    selectedRange.insertNode(textNode);

    // Clear selection and hide toolbar
    selection.removeAllRanges();
    hideFormatToolbar();
    
    // Update the chat data
    updateChatDataFromElement(currentEditingElement);
}

function updateChatDataFromElement(element) {
    const messageIndex = element.dataset.messageIndex;
    const field = element.dataset.field;
    
    if (chatData && messageIndex !== undefined && field) {
        chatData.messages[messageIndex][field] = element.innerHTML;
    }
}

// Event listeners for text selection
document.addEventListener('mouseup', function(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Check if selection is within an editable element
        let editableElement = range.commonAncestorContainer;
        while (editableElement && editableElement.nodeType !== 1) {
            editableElement = editableElement.parentNode;
        }
        
        if (editableElement && editableElement.classList && editableElement.classList.contains('editable-text')) {
            selectedRange = range;
            currentEditingElement = editableElement;
            showFormatToolbar(rect.left + rect.width / 2, rect.top);
        } else {
            hideFormatToolbar();
        }
    } else {
        hideFormatToolbar();
    }
});

// Hide toolbar when clicking elsewhere
document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('#formatToolbar') && !e.target.closest('.editable-text')) {
        hideFormatToolbar();
    }
});

// Updated makeEditableWithFormatting function to support formatting
function makeEditableWithFormattingWithFormatting(element, messageIndex, field) {
    element.contentEditable = true;
    element.dataset.messageIndex = messageIndex;
    element.dataset.field = field;
    element.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Save original value
    const originalValue = element.innerHTML;
    
    // Handle blur (save)
    element.onblur = function() {
        element.contentEditable = false;
        const newValue = element.innerHTML.trim();
        
        if (newValue !== originalValue && chatData) {
            chatData.messages[messageIndex][field] = newValue;
        }
        
        // Clean up
        delete element.dataset.messageIndex;
        delete element.dataset.field;
        hideFormatToolbar();
    };
    
    // Handle enter key
    element.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        }
        // Prevent newlines in names
        if (field === 'characterName' && e.key === 'Enter') {
            e.preventDefault();
        }
    };
}

// Pagination Functions
function updatePaginationInfo() {
    if (!chatData || !chatData.messages) {
        totalPages = 1;
        currentPage = 1;
        document.getElementById('pageInfo').textContent = '1 / 1';
        document.getElementById('prevPageBtn').disabled = true;
        document.getElementById('nextPageBtn').disabled = true;
        return;
    }

    const limit = parseInt(document.getElementById('messageLimit').value);
    totalPages = Math.ceil(chatData.messages.length / limit);
    
    // Ensure current page is within bounds
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }

    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        updatePaginationInfo();
        renderMessages();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        updatePaginationInfo();
        renderMessages();
    }
}

function resetPagination() {
    currentPage = 1;
    updatePaginationInfo();
}


// Move specific message up (swap with previous message)
function moveMessageUp(index) {
    if (!chatData || !chatData.messages || index <= 0) return;
    
    // Swap with previous message
    const temp = chatData.messages[index];
    chatData.messages[index] = chatData.messages[index - 1];
    chatData.messages[index - 1] = temp;
    
    renderMessages();
}

// Move specific message down (swap with next message)
function moveMessageDown(index) {
    if (!chatData || !chatData.messages || index >= chatData.messages.length - 1) return;
    
    // Swap with next message
    const temp = chatData.messages[index];
    chatData.messages[index] = chatData.messages[index + 1];
    chatData.messages[index + 1] = temp;
    
    renderMessages();
}


// Color Block Functions
function addColorBlock(messageIndex) {
    if (!chatData || !chatData.messages[messageIndex]) return;
    
    const defaultColor = document.getElementById('defaultBlockColor').value;
    const defaultOpacity = document.getElementById('defaultBlockOpacity').value / 100;
    
    if (!chatData.messages[messageIndex].colorBlocks) {
        chatData.messages[messageIndex].colorBlocks = [];
    }
    
    chatData.messages[messageIndex].colorBlocks.push({
        color: defaultColor,
        opacity: defaultOpacity,
        content: ''
    });
    
    renderMessages();
}

function deleteColorBlock(messageIndex, blockIndex) {
    if (!chatData || !chatData.messages[messageIndex] || !chatData.messages[messageIndex].colorBlocks) return;
    
    chatData.messages[messageIndex].colorBlocks.splice(blockIndex, 1);
    
    // Remove colorBlocks array if empty
    if (chatData.messages[messageIndex].colorBlocks.length === 0) {
        delete chatData.messages[messageIndex].colorBlocks;
    }
    
    renderMessages();
}

// Enhanced makeEditableWithFormatting to handle nested properties
function makeEditableWithFormattingNested(element, messageIndex, field) {
    element.contentEditable = true;
    element.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Save original value
    const originalValue = element.textContent;
    
    // Handle blur (save)
    element.onblur = function() {
        element.contentEditable = false;
        const newValue = element.textContent.trim();
        
        if (newValue !== originalValue && chatData) {
            // Handle nested properties like 'colorBlocks.0.content'
            const fieldParts = field.split('.');
            let target = chatData.messages[messageIndex];
            
            for (let i = 0; i < fieldParts.length - 1; i++) {
                if (!target[fieldParts[i]]) {
                    target[fieldParts[i]] = {};
                }
                target = target[fieldParts[i]];
            }
            
            target[fieldParts[fieldParts.length - 1]] = newValue;
        }
    };
    
    // Handle enter key
    element.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        }
    };
}

// Load from clipboard button function
async function loadFromClipboard() {
    // Only allow clipboard reading when no data is loaded
    if (chatData) {
        alert('이미 데이터가 로드되어 있습니다. 새로고침 후 다시 시도해주세요.');
        return;
    }
    
    try {
        // Show loading state in file status
        const fileStatus = document.getElementById('fileStatus');
        fileStatus.classList.add('active');
        fileStatus.textContent = '🔄 클립보드에서 읽는 중...';
        fileStatus.style.background = '#fff3cd';
        fileStatus.style.borderColor = '#ffeeba';
        fileStatus.style.color = '#856404';
        
        // Request clipboard permission and read text
        const clipboardText = await navigator.clipboard.readText();
        
        if (!clipboardText.trim()) {
            throw new Error('클립보드가 비어있습니다.');
        }
        
        // Try to parse as JSON
        let parsedData;
        try {
            parsedData = JSON.parse(clipboardText);
        } catch (parseError) {
            throw new Error('유효한 JSON 형식이 아닙니다.');
        }
        
        // Validate structure
        if (!parsedData.messages || !Array.isArray(parsedData.messages)) {
            throw new Error('올바른 코코포리아 채팅 기록 형식이 아닙니다.');
        }
        
        // Success - process the data
        await processClipboardData(parsedData);
        
    } catch (error) {
        // Show error in file status
        const fileStatus = document.getElementById('fileStatus');
        fileStatus.classList.add('active');
        fileStatus.textContent = `❌ ${error.message}`;
        fileStatus.style.background = '#f8d7da';
        fileStatus.style.borderColor = '#f5c6cb';
        fileStatus.style.color = '#721c24';
        
        // Auto-hide error after 3 seconds
        setTimeout(() => {
            fileStatus.classList.remove('active');
            fileStatus.style.background = '';
            fileStatus.style.borderColor = '';
            fileStatus.style.color = '';
        }, 3000);
    }
}

// Clipboard functionality
async function handleContainerClick() {
    // Only allow clipboard reading when no data is loaded
    if (chatData) return;
    
    try {
        // Show loading state
        const container = document.getElementById('chatContainer');
        const originalContent = container.innerHTML;
        
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px; color: #8b9dc3;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
                <div style="font-size: 16px; font-weight: 500; color: #65676b;">클립보드에서 읽는 중...</div>
            </div>
        `;
        
        // Request clipboard permission and read text
        const clipboardText = await navigator.clipboard.readText();
        
        if (!clipboardText.trim()) {
            throw new Error('클립보드가 비어있습니다.');
        }
        
        // Try to parse as JSON
        let parsedData;
        try {
            parsedData = JSON.parse(clipboardText);
        } catch (parseError) {
            throw new Error('유효한 JSON 형식이 아닙니다.');
        }
        
        // Validate structure
        if (!parsedData.messages || !Array.isArray(parsedData.messages)) {
            throw new Error('올바른 코코포리아 채팅 기록 형식이 아닙니다.');
        }
        
        // Success - process the data
        await processClipboardData(parsedData);
        
    } catch (error) {
        // Show error state
        const container = document.getElementById('chatContainer');
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px; color: #8b9dc3; cursor: pointer;" onclick="handleContainerClick()">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 16px; font-weight: 500; color: #c62828;">${error.message}</div>
                <div style="font-size: 14px; color: #8b9dc3; margin-top: 8px;">다시 시도하려면 클릭하세요</div>
                <div style="font-size: 12px; color: #4267b2; margin-top: 12px; font-weight: 500;">📋 또는 파일을 선택해주세요</div>
            </div>
        `;
        
        // Auto-restore after 3 seconds
        setTimeout(() => {
            if (!chatData) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 80px 20px; color: #8b9dc3; cursor: pointer;" onclick="handleContainerClick()">
                        <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                        <div style="font-size: 16px; font-weight: 500; color: #65676b;">JSON 파일을 불러와주세요</div>
                        <div style="font-size: 14px; color: #8b9dc3; margin-top: 8px;">코코포리아 채팅 기록 파일을 선택해주세요</div>
                        <div style="font-size: 12px; color: #4267b2; margin-top: 12px; font-weight: 500;">📋 또는 클립보드에서 가져오려면 여기를 클릭하세요</div>
                    </div>
                `;
            }
        }, 3000);
    }
}

async function processClipboardData(parsedData) {
    // Use the same logic as file input
    chatData = parsedData;
    originalChatData = JSON.parse(JSON.stringify(parsedData)); // Deep copy
    
    // Update file status
    const fileStatus = document.getElementById('fileStatus');
    fileStatus.classList.add('active');
    fileStatus.textContent = '✅ 클립보드에서 로드 완료';
    fileStatus.style.background = '#d4edda';
    fileStatus.style.borderColor = '#c3e6cb';
    fileStatus.style.color = '#155724';
    
    // Update stats
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.style.display = 'grid';
    
    document.getElementById('totalMessages').textContent = chatData.messages.length;
    
    // Count unique characters and create name mapping
    const uniqueCharacters = [...new Set(chatData.messages
        .filter(m => m.characterName !== 'Unknown' && m.characterName !== 'PL 웃')
        .map(m => m.characterName))];
    document.getElementById('totalCharacters').textContent = uniqueCharacters.length;
    
    // Create name change controls
    createNameChangeControls(uniqueCharacters);
    
    // Reset pagination when new data is loaded
    resetPagination();
    renderMessages();
}

// Initialize
applySettings();