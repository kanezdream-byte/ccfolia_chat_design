// 전역 상태 관리
const AppState = {
    rawData: null,
    messages: [],
    cards: [],
    currentCardIndex: 0,
    selectedBlocks: new Set(),
    currentRatio: '1:1',
    currentBgType: 'solid',
    currentCardSize: { width: 400, height: 600 },
    currentTheme: {
        background: '#ffffff',
        gradient: ['#667eea', '#764ba2'],
        gradientAngle: 180,
        pattern: 'dots',
        patternColor: '#e0e0e0',
        imageUrl: null,
        overlay: false,
        blur: 0
    },
    textStyle: {
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: 16,
        color: '#000000',
        align: 'center',
        lineHeight: 1.6
    },
    cardPadding: 40,
    zoomLevel: 100,
    currentTemplate: 'default',
    sidebarCollapsed: false
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSavedSession();
});

function initializeApp() {
    // 드래그 앤 드롭 설정
    setupDragAndDrop();
    // 키보드 단축키 설정
    setupKeyboardShortcuts();
    // 자동 저장 설정
    setInterval(saveSession, 30000); // 30초마다 자동 저장
}

// 데이터 입력 관련 함수들
function switchInputTab(type) {
    document.querySelectorAll('.input-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.input-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`${type}InputContent`).style.display = 'block';
}

async function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        processData(data);
        showNotification('파일을 성공적으로 로드했습니다.', 'success');
    } catch (error) {
        showNotification('올바른 JSON 파일이 아닙니다.', 'error');
    }
}

function loadFromText() {
    const text = document.getElementById('jsonText').value;
    try {
        const data = JSON.parse(text);
        processData(data);
        showNotification('데이터를 성공적으로 로드했습니다.', 'success');
    } catch (error) {
        showNotification('올바른 JSON 형식이 아닙니다.', 'error');
    }
}

async function loadFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        processData(data);
        showNotification('클립보드에서 데이터를 로드했습니다.', 'success');
    } catch (error) {
        showNotification('클립보드에 올바른 JSON 데이터가 없습니다.', 'error');
    }
}

// 데이터 처리
function processData(data) {
    AppState.rawData = data;
    AppState.messages = parseMessages(data.messages);
    renderTextBlocks();
    updateMessageCount();
}

function parseMessages(messages) {
    return messages.map((msg, index) => ({
        id: index,
        character: msg.characterName === 'Unknown' ? '지문' : msg.characterName,
        content: cleanText(msg.content),
        originalContent: msg.content,
        time: msg.time
    }));
}

function cleanText(text) {
    return text
        .replace(/\[편집\s*완료\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// 텍스트 블록 렌더링
function renderTextBlocks() {
    const container = document.getElementById('textBlocks');
    container.innerHTML = '';
    
    if (AppState.messages.length === 0) {
        container.innerHTML = '<div class="empty-message">데이터를 로드하면 텍스트가 표시됩니다</div>';
        return;
    }
    
    AppState.messages.forEach(msg => {
        const block = document.createElement('div');
        block.className = 'text-block';
        block.dataset.id = msg.id;
        
        // 괄호 제거 옵션 적용
        let displayContent = msg.content;
        if (document.getElementById('removeParentheses')?.checked) {
            displayContent = displayContent.replace(/\([^)]*\)/g, '').trim();
        }
        
        block.innerHTML = `
            <div class="block-character">${msg.character}</div>
            <div class="block-text">${displayContent}</div>
        `;
        
        block.onclick = () => toggleBlockSelection(msg.id);
        container.appendChild(block);
    });
}

// 블록 선택 관리 (즉시 반응)
function toggleBlockSelection(id) {
    const block = document.querySelector(`.text-block[data-id="${id}"]`);
    
    if (AppState.selectedBlocks.has(id)) {
        AppState.selectedBlocks.delete(id);
        block.classList.remove('selected');
    } else {
        AppState.selectedBlocks.add(id);
        block.classList.add('selected');
    }
    
    // 즉시 카드 내용 업데이트
    updateCurrentCardContent();
}

// 현재 카드 내용을 선택된 블록으로 즉시 업데이트
function updateCurrentCardContent() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) return;
    
    if (AppState.selectedBlocks.size === 0) {
        current.content = '텍스트 블록을 선택해주세요.';
    } else {
        const selectedMessages = Array.from(AppState.selectedBlocks)
            .map(id => AppState.messages.find(m => m.id === id))
            .filter(Boolean)
            .sort((a, b) => a.id - b.id); // ID 순으로 정렬
        
        const content = selectedMessages
            .map(msg => {
                let text = msg.content;
                // 괄호 제거 옵션이 있다면 적용
                const removeParentheses = document.getElementById('removeParentheses');
                if (removeParentheses && removeParentheses.checked) {
                    text = text.replace(/\([^)]*\)/g, '').trim();
                }
                return text;
            })
            .join('\n\n');
        
        current.content = content;
    }
    
    // 텍스트 오버플로우 체크 및 처리
    handleTextOverflow(current);
    
    // 카드 렌더링
    renderCard(current);
    
    // 세션 저장
    debouncedSaveSession();
}

function selectAllBlocks() {
    AppState.messages.forEach(msg => {
        AppState.selectedBlocks.add(msg.id);
        document.querySelector(`.text-block[data-id="${msg.id}"]`)?.classList.add('selected');
    });
    // 즉시 카드 내용 업데이트
    updateCurrentCardContent();
}

function clearBlockSelection() {
    AppState.selectedBlocks.clear();
    document.querySelectorAll('.text-block').forEach(block => {
        block.classList.remove('selected');
    });
    // 즉시 카드 내용 업데이트
    updateCurrentCardContent();
}

// 카드 관리
function addNewCard() {
    const cardId = `card-${Date.now()}`;
    const card = {
        id: cardId,
        content: '',
        title: '제목',
        author: '작성자',
        ratio: AppState.currentRatio,
        size: { ...AppState.currentCardSize },
        theme: { ...AppState.currentTheme },
        textStyle: { ...AppState.textStyle },
        padding: AppState.cardPadding,
        template: AppState.currentTemplate
    };
    
    AppState.cards.push(card);
    AppState.currentCardIndex = AppState.cards.length - 1;
    renderCard(card);
    updateCardInfo();
}

function addSelectedToCard() {
    if (AppState.selectedBlocks.size === 0) {
        showNotification('텍스트 블록을 선택해주세요.', 'info');
        return;
    }
    
    const selectedMessages = Array.from(AppState.selectedBlocks)
        .map(id => AppState.messages.find(m => m.id === id))
        .filter(Boolean);
    
    const content = selectedMessages
        .map(msg => {
            let text = msg.content;
            if (document.getElementById('removeParentheses')?.checked) {
                text = text.replace(/\([^)]*\)/g, '').trim();
            }
            return text;
        })
        .join('\n\n');
    
    const characters = [...new Set(selectedMessages
        .filter(m => m.character !== '지문')
        .map(m => m.character))];
    
    const cardId = `card-${Date.now()}`;
    const card = {
        id: cardId,
        content: content,
        title: document.getElementById('scenarioName')?.value || '제목',
        author: characters.join(', ') || '작성자',
        ratio: AppState.currentRatio,
        theme: { ...AppState.currentTheme },
        textStyle: { ...AppState.textStyle },
        padding: AppState.cardPadding
    };
    
    AppState.cards.push(card);
    AppState.currentCardIndex = AppState.cards.length - 1;
    renderCard(card);
    updateCardInfo();
    clearBlockSelection();
    
    showNotification('카드가 생성되었습니다.', 'success');
}

function renderCard(card) {
    const canvas = document.getElementById('cardCanvas');
    
    const cardElement = document.createElement('div');
    const template = card.template || AppState.currentTemplate || 'default';
    // 클래스명 설정 (템플릿 클래스 추가)
    let className = `book-card ratio-${card.ratio.replace(':', '-')}`;
    if (template !== 'default') {
        className += ` template-${template}`;
    }
    cardElement.className = className;
    cardElement.dataset.cardId = card.id;
    
    // 템플릿별 배경 처리
    let bgStyle = '';
    if (template === 'default' || template === 'readwise' || template === 'notion') {
        bgStyle = getBackgroundStyle(card.theme);
    }
    
    // 텍스트 포맷팅
    let formattedContent = card.content || '클릭하여 텍스트를 입력하세요';
    if (card.textStyle.align === 'center') {
        formattedContent = formattedContent.replace(/\n/g, '<br>');
    }
    
    // 모든 템플릿에 사용자 텍스트 스타일 적용 (템플릿 고유 스타일과 병합)
    let textStyle = `
        font-family: ${card.textStyle.fontFamily} !important;
        font-size: ${card.textStyle.fontSize}px !important;
        color: ${card.textStyle.color} !important;
        text-align: ${card.textStyle.align} !important;
        line-height: ${card.textStyle.lineHeight} !important;
    `;
    
    // 패딩 설정 (템플릿별로 다르게 처리)
    let contentPadding = template === 'default' ? `${card.padding}px` : '';
    
    cardElement.innerHTML = `
        <div class="card-background" style="${bgStyle}"></div>
        <div class="card-content" ${contentPadding ? `style="padding: ${contentPadding};"` : ''}>
            <div class="card-text" 
                 contenteditable="true"
                 style="${textStyle}"
                 onblur="updateCardContent('${card.id}', this.innerHTML)">
                ${formattedContent}
            </div>
        </div>
        <div class="card-footer">
            <div class="card-title" contenteditable="true" onblur="updateCardTitle('${card.id}', this.textContent)">
                ${card.title || '제목'}
            </div>
            <div class="card-author" contenteditable="true" onblur="updateCardAuthor('${card.id}', this.textContent)">
                ${card.author || '작성자'}
            </div>
        </div>
    `;
    
    // 카드 크기 동적 적용
    if (card.size) {
        cardElement.style.width = `${card.size.width}px`;
        cardElement.style.height = `${card.size.height}px`;
        cardElement.style.maxWidth = 'none';
        cardElement.style.maxHeight = 'none';
    }
    
    canvas.innerHTML = '';
    canvas.appendChild(cardElement);
}

function getBackgroundStyle(theme) {
    switch (AppState.currentBgType) {
        case 'solid':
            return `background: ${theme.background};`;
        
        case 'gradient':
            return `background: linear-gradient(${theme.gradientAngle}deg, ${theme.gradient[0]}, ${theme.gradient[1]});`;
        
        case 'image':
            if (!theme.imageUrl) return `background: #f0f0f0;`;
            let style = `background-image: url('${theme.imageUrl}'); background-size: cover; background-position: center;`;
            if (theme.blur > 0) {
                style += ` filter: blur(${theme.blur}px);`;
            }
            return style;
        
        case 'pattern':
            return getPatternStyle(theme.pattern, theme.patternColor);
        
        default:
            return `background: white;`;
    }
}

function getPatternStyle(pattern, color) {
    const patterns = {
        dots: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
        lines: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${color} 10px, ${color} 11px)`,
        grid: `repeating-linear-gradient(0deg, ${color}, ${color} 1px, transparent 1px, transparent 20px),
               repeating-linear-gradient(90deg, ${color}, ${color} 1px, transparent 1px, transparent 20px)`,
        zigzag: `linear-gradient(135deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%)`
    };
    
    return `background: ${patterns[pattern] || patterns.dots}; background-size: 20px 20px;`;
}

// 카드 업데이트 함수들
function updateCardContent(cardId, content) {
    const card = AppState.cards.find(c => c.id === cardId);
    if (card) {
        card.content = content;
        saveSession();
    }
}

function updateCardTitle(cardId, title) {
    const card = AppState.cards.find(c => c.id === cardId);
    if (card) {
        card.title = title;
        saveSession();
    }
}

function updateCardAuthor(cardId, author) {
    const card = AppState.cards.find(c => c.id === cardId);
    if (card) {
        card.author = author;
        saveSession();
    }
}

// 카드 네비게이션
function previousCard() {
    if (AppState.currentCardIndex > 0) {
        AppState.currentCardIndex--;
        renderCard(AppState.cards[AppState.currentCardIndex]);
        updateCardInfo();
    }
}

function nextCard() {
    if (AppState.currentCardIndex < AppState.cards.length - 1) {
        AppState.currentCardIndex++;
        renderCard(AppState.cards[AppState.currentCardIndex]);
        updateCardInfo();
    }
}

function updateCardInfo() {
    const info = document.getElementById('cardInfo');
    info.textContent = `${AppState.currentCardIndex + 1} / ${AppState.cards.length}`;
}

// 카드 설정 함수들
function setCardRatio(ratio) {
    document.querySelectorAll('.ratio-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    AppState.currentRatio = ratio;
    
    if (ratio === 'custom') {
        document.getElementById('customRatio').style.display = 'flex';
    } else {
        document.getElementById('customRatio').style.display = 'none';
        if (AppState.cards[AppState.currentCardIndex]) {
            AppState.cards[AppState.currentCardIndex].ratio = ratio;
            renderCard(AppState.cards[AppState.currentCardIndex]);
        }
    }
}

function switchBgType(type) {
    document.querySelectorAll('.bg-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.bg-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`bg${type.charAt(0).toUpperCase() + type.slice(1)}`).style.display = 'block';
    
    AppState.currentBgType = type;
    updateBackground();
}

function updateBackground() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) return;
    
    switch (AppState.currentBgType) {
        case 'solid':
            current.theme.background = document.getElementById('bgColor').value;
            break;
        case 'gradient':
            current.theme.gradient = [
                document.getElementById('gradColor1').value,
                document.getElementById('gradColor2').value
            ];
            current.theme.gradientAngle = parseInt(document.getElementById('gradAngle').value);
            break;
        case 'image':
            current.theme.imageUrl = document.getElementById('bgImageUrl').value;
            current.theme.overlay = document.getElementById('bgOverlay').checked;
            current.theme.blur = parseInt(document.getElementById('bgBlur').value);
            break;
        case 'pattern':
            current.theme.pattern = document.getElementById('patternType').value;
            current.theme.patternColor = document.getElementById('patternColor').value;
            break;
    }
    
    renderCard(current);
}

async function loadBackgroundImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('bgImageUrl').value = e.target.result;
        updateBackground();
    };
    reader.readAsDataURL(file);
}

function updateTextStyle() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) return;
    
    current.textStyle = {
        fontFamily: document.getElementById('fontFamily').value,
        fontSize: parseInt(document.getElementById('fontSize').value),
        color: document.getElementById('textColor').value,
        align: current.textStyle.align,
        lineHeight: parseFloat(document.getElementById('lineHeight').value)
    };
    
    document.getElementById('fontSizeValue').textContent = `${current.textStyle.fontSize}px`;
    renderCard(current);
}

function setTextAlign(align) {
    document.querySelectorAll('.align-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.textStyle.align = align;
        renderCard(current);
    }
}

function updateCardPadding() {
    const padding = parseInt(document.getElementById('cardPadding').value);
    document.getElementById('paddingValue').textContent = `${padding}px`;
    
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.padding = padding;
        renderCard(current);
    }
}

// 템플릿별 권장 사이즈 정의
const TEMPLATE_SIZES = {
    'default': { width: 400, height: 600 },
    'readwise': { width: 500, height: 700 },
    'kindle': { width: 450, height: 650 },
    'notion': { width: 400, height: 600 }
};

// 템플릿별 권장 폰트 설정 정의
const TEMPLATE_FONTS = {
    'default': {
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: 16,
        color: '#000000',
        align: 'center',
        lineHeight: 1.6
    },
    'readwise': {
        fontFamily: "'Crimson Text', Georgia, serif",
        fontSize: 24,
        color: '#2C2C2C',
        align: 'center',
        lineHeight: 1.6
    },
    'kindle': {
        fontFamily: "'Bookerly', 'Palatino', serif",
        fontSize: 18,
        color: '#1a1a1a',
        align: 'left',
        lineHeight: 1.7
    },
    'notion': {
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: 16,
        color: '#2d3748',
        align: 'left',
        lineHeight: 1.6
    }
};

// 카드 크기 설정 함수
function setCardSize(width, height) {
    // 커스텀 사이즈 입력 처리
    if (width === 'custom' && height === 'custom') {
        showCustomSizeInput();
        return;
    }
    
    // 사이즈 검증
    const newWidth = parseInt(width);
    const newHeight = parseInt(height);
    
    if (isNaN(newWidth) || isNaN(newHeight) || newWidth < 200 || newHeight < 200 || newWidth > 4000 || newHeight > 4000) {
        showNotification('올바른 크기를 입력해주세요. (200~4000px)', 'error');
        return;
    }
    
    // 버튼 상태 업데이트
    updateSizeButtonState(newWidth, newHeight);
    
    // 상태 업데이트
    AppState.currentCardSize = { width: newWidth, height: newHeight };
    
    // 현재 카드 업데이트 (애니메이션 효과 포함)
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.size = { width: newWidth, height: newHeight };
        
        // 애니메이션 효과를 위한 클래스 추가
        const cardElement = document.querySelector('.book-card');
        if (cardElement) {
            cardElement.classList.add('size-changing');
            
            // 애니메이션 완료 후 클래스 제거
            setTimeout(() => {
                cardElement.classList.remove('size-changing');
            }, 400);
        }
        
        renderCard(current);
        showNotification(`카드 크기가 ${newWidth}×${newHeight}px로 변경되었습니다.`, 'success');
    }
    
    // 커스텀 사이즈 입력 숨기기
    hideCustomSizeInput();
}

// 커스텀 사이즈 적용 함수
function applyCustomSize() {
    const widthInput = document.getElementById('customWidth');
    const heightInput = document.getElementById('customHeight');
    
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    
    if (isNaN(width) || isNaN(height)) {
        showNotification('숫자를 입력해주세요.', 'error');
        return;
    }
    
    setCardSize(width, height);
}

// 커스텀 사이즈 입력 표시/숨김
function showCustomSizeInput() {
    const customSizeDiv = document.getElementById('customSize');
    if (customSizeDiv) {
        customSizeDiv.style.display = 'block';
    }
}

function hideCustomSizeInput() {
    const customSizeDiv = document.getElementById('customSize');
    if (customSizeDiv) {
        customSizeDiv.style.display = 'none';
    }
}

// 사이즈 버튼 상태 업데이트
function updateSizeButtonState(width, height) {
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 해당하는 사이즈 버튼 찾아서 활성화
    const sizeButtons = document.querySelectorAll('.size-btn');
    for (const btn of sizeButtons) {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`${width}, ${height}`)) {
            btn.classList.add('active');
            break;
        }
    }
}

// 템플릿 설정 함수
function setCardTemplate(template) {
    // 버튼 상태 업데이트
    document.querySelectorAll('.template-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    AppState.currentTemplate = template;
    
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.template = template;
        
        // 템플릿별 권장 사이즈 자동 적용
        const recommendedSize = TEMPLATE_SIZES[template];
        if (recommendedSize) {
            current.size = { ...recommendedSize };
            AppState.currentCardSize = { ...recommendedSize };
            updateSizeButtonState(recommendedSize.width, recommendedSize.height);
        }
        
        // 템플릿별 권장 폰트 설정 자동 적용
        const recommendedFont = TEMPLATE_FONTS[template];
        if (recommendedFont) {
            current.textStyle = { ...recommendedFont };
            AppState.textStyle = { ...recommendedFont };
            updateFontControlsUI();
        }
        
        renderCard(current);
    }
    
    // 템플릿별 특수 설정
    if (template === 'kindle' || template === 'pinterest') {
        // 이미지가 필요한 템플릿의 경우 배경 이미지 탭으로 자동 전환
        if (!AppState.currentTheme.imageUrl) {
            switchBgType('image');
            showNotification('이 템플릿은 배경 이미지가 권장됩니다.', 'info');
        }
    }
}

// 클립보드 복사 기능
async function copyCardToClipboard() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) {
        showNotification('복사할 카드가 없습니다.', 'error');
        return;
    }

    try {
        // 버튼 로딩 상태
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<span>⏳</span> 복사 중...';
        button.disabled = true;

        // 현재 카드 엘리먼트 찾기
        const cardElement = document.querySelector('.book-card');
        if (!cardElement) {
            throw new Error('카드 엘리먼트를 찾을 수 없습니다.');
        }

        // HTML2Canvas로 카드를 이미지로 변환
        const canvas = await html2canvas(cardElement, {
            backgroundColor: null,
            scale: 2, // 고해상도
            allowTaint: true,
            useCORS: true,
            logging: false
        });

        // Canvas를 Blob으로 변환
        canvas.toBlob(async (blob) => {
            try {
                // ClipboardItem으로 클립보드에 복사
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                
                showNotification('카드가 클립보드에 복사되었습니다!', 'success');
                
                // 카드에 복사 애니메이션 효과
                cardElement.style.animation = 'copyFlash 0.6s ease-out';
                setTimeout(() => {
                    cardElement.style.animation = '';
                }, 600);
                
            } catch (error) {
                console.error('클립보드 복사 실패:', error);
                showNotification('클립보드 복사에 실패했습니다.', 'error');
            } finally {
                // 버튼 상태 복원
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }, 'image/png');

    } catch (error) {
        console.error('카드 캡처 실패:', error);
        showNotification('카드 이미지 생성에 실패했습니다.', 'error');
        
        // 버튼 상태 복원
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// 줌 컨트롤
function zoomIn() {
    AppState.zoomLevel = Math.min(200, AppState.zoomLevel + 10);
    updateZoom();
}

function zoomOut() {
    AppState.zoomLevel = Math.max(50, AppState.zoomLevel - 10);
    updateZoom();
}

function resetZoom() {
    AppState.zoomLevel = 100;
    updateZoom();
}

function updateZoom() {
    document.getElementById('zoomLevel').textContent = `${AppState.zoomLevel}%`;
    const card = document.querySelector('.book-card');
    if (card) {
        card.style.transform = `scale(${AppState.zoomLevel / 100})`;
        card.style.transformOrigin = 'center';
    }
}

// 알림 시스템 개선
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// 페이지 정보 업데이트
function updatePageInfo() {
    const pageInfo = document.getElementById('cardInfo');
    if (pageInfo) {
        const total = AppState.cards.length;
        const current = total > 0 ? AppState.currentCardIndex + 1 : 0;
        pageInfo.textContent = `${current} / ${total}`;
    }
}

// 내보내기 함수들
async function exportCard() {
    const card = document.querySelector('.book-card');
    if (!card) {
        showNotification('내보낼 카드가 없습니다.', 'error');
        return;
    }
    
    try {
        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: null
        });
        
        const link = document.createElement('a');
        link.download = `bookcard-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        showNotification('카드를 저장했습니다.', 'success');
    } catch (error) {
        showNotification('저장 중 오류가 발생했습니다.', 'error');
    }
}

// 스크린샷 캡처 (화면에 보이는 영역)
async function captureScreenshot() {
    const workspace = document.querySelector('.workspace');
    if (!workspace) {
        showNotification('캡처할 영역이 없습니다.', 'error');
        return;
    }
    
    try {
        // 컨트롤 패널 임시 숨기기
        const controlPanel = document.querySelector('.control-panel');
        const originalDisplay = controlPanel.style.display;
        controlPanel.style.display = 'none';
        
        // 스크린샷 캡처
        const canvas = await html2canvas(workspace, {
            scale: 2,
            backgroundColor: '#1a1a1a',
            logging: false,
            useCORS: true
        });
        
        // 컨트롤 패널 복원
        controlPanel.style.display = originalDisplay;
        
        // 이미지 다운로드
        const link = document.createElement('a');
        link.download = `screenshot-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        showNotification('스크린샷을 저장했습니다.', 'success');
    } catch (error) {
        showNotification('스크린샷 캡처 실패', 'error');
        console.error(error);
    }
}

// 클립보드로 복사
async function copyToClipboard() {
    const card = document.querySelector('.book-card');
    if (!card) {
        showNotification('복사할 카드가 없습니다.', 'error');
        return;
    }
    
    try {
        const canvas = await html2canvas(card, {
            scale: 2,
            backgroundColor: null
        });
        
        // Canvas를 Blob으로 변환
        canvas.toBlob(async (blob) => {
            try {
                // 클립보드 API 사용
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                
                showNotification('카드가 클립보드에 복사되었습니다.', 'success');
                
                // 시각적 피드백
                card.style.animation = 'copyFlash 0.3s';
                setTimeout(() => {
                    card.style.animation = '';
                }, 300);
                
            } catch (clipboardError) {
                // 클립보드 API 실패 시 대체 방법
                fallbackCopyToClipboard(canvas);
            }
        }, 'image/png');
        
    } catch (error) {
        showNotification('클립보드 복사 실패', 'error');
        console.error(error);
    }
}

// 클립보드 복사 대체 방법
function fallbackCopyToClipboard(canvas) {
    try {
        // 임시 이미지 요소 생성
        const img = new Image();
        img.src = canvas.toDataURL();
        
        // 선택 가능한 영역 생성
        const div = document.createElement('div');
        div.contentEditable = true;
        div.appendChild(img);
        div.style.position = 'fixed';
        div.style.left = '-9999px';
        document.body.appendChild(div);
        
        // 이미지 선택 및 복사
        const range = document.createRange();
        range.selectNodeContents(div);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.execCommand('copy');
        document.body.removeChild(div);
        
        showNotification('카드가 클립보드에 복사되었습니다. (대체 방법)', 'info');
    } catch (error) {
        showNotification('클립보드 복사를 사용할 수 없습니다.', 'error');
    }
}

// 전체 화면 캡처
async function captureFullPage() {
    const cardGrid = document.querySelector('.card-canvas');
    if (!cardGrid || AppState.cards.length === 0) {
        showNotification('캡처할 카드가 없습니다.', 'error');
        return;
    }
    
    try {
        // 모든 카드를 임시 컨테이너에 렌더링
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            left: -9999px;
            width: 1200px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            padding: 40px;
            background: #1a1a1a;
        `;
        
        // 모든 카드 복사
        for (const cardData of AppState.cards) {
            const cardClone = createCardElement(cardData);
            tempContainer.appendChild(cardClone);
        }
        
        document.body.appendChild(tempContainer);
        
        // 전체 페이지 캡처
        const canvas = await html2canvas(tempContainer, {
            scale: 2,
            backgroundColor: '#1a1a1a'
        });
        
        // 임시 컨테이너 제거
        document.body.removeChild(tempContainer);
        
        // 다운로드
        const link = document.createElement('a');
        link.download = `all-cards-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        showNotification('전체 카드를 캡처했습니다.', 'success');
    } catch (error) {
        showNotification('전체 캡처 실패', 'error');
        console.error(error);
    }
}

// 카드 요소 생성 헬퍼 함수
function createCardElement(cardData) {
    const card = document.createElement('div');
    const template = cardData.template || 'default';
    
    // 클래스명 설정 (템플릿 클래스 추가)
    let className = `book-card ratio-${cardData.ratio.replace(':', '-')}`;
    if (template !== 'default') {
        className += ` template-${template}`;
    }
    card.className = className;
    
    // 카드 크기 동적 적용
    if (cardData.size) {
        card.style.width = `${cardData.size.width}px`;
        card.style.height = `${cardData.size.height}px`;
        card.style.maxWidth = 'none';
        card.style.maxHeight = 'none';
    }
    
    const bgStyle = getBackgroundStyle(cardData.theme);
    
    card.innerHTML = `
        <div class="card-background" style="${bgStyle}"></div>
        <div class="card-content" style="padding: ${cardData.padding}px;">
            <div class="card-text" style="
                font-family: ${cardData.textStyle.fontFamily};
                font-size: ${cardData.textStyle.fontSize}px;
                color: ${cardData.textStyle.color};
                text-align: ${cardData.textStyle.align};
                line-height: ${cardData.textStyle.lineHeight};
            ">
                ${cardData.content}
            </div>
        </div>
        <div class="card-footer">
            <div class="card-title">${cardData.title}</div>
            <div class="card-author">${cardData.author}</div>
        </div>
    `;
    
    return card;
}

async function exportAllCards() {
    if (AppState.cards.length === 0) {
        showNotification('저장할 카드가 없습니다.', 'error');
        return;
    }
    
    for (let i = 0; i < AppState.cards.length; i++) {
        renderCard(AppState.cards[i]);
        await new Promise(resolve => setTimeout(resolve, 500));
        await exportCard();
    }
    
    showNotification(`${AppState.cards.length}개의 카드를 저장했습니다.`, 'success');
}

// 세션 관리
function saveSession() {
    const session = {
        cards: AppState.cards,
        messages: AppState.messages,
        currentCardSize: AppState.currentCardSize,
        currentTemplate: AppState.currentTemplate,
        currentTheme: AppState.currentTheme,
        textStyle: AppState.textStyle,
        cardPadding: AppState.cardPadding,
        currentBgType: AppState.currentBgType,
        sidebarCollapsed: AppState.sidebarCollapsed,
        timestamp: Date.now()
    };
    localStorage.setItem('bookcard_session', JSON.stringify(session));
}

function loadSavedSession() {
    const saved = localStorage.getItem('bookcard_session');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            if (Date.now() - session.timestamp < 86400000) { // 24시간 이내
                // 기본 데이터 복원
                AppState.cards = session.cards || [];
                AppState.messages = session.messages || [];
                
                // 상태 복원
                if (session.currentCardSize) {
                    AppState.currentCardSize = session.currentCardSize;
                }
                if (session.currentTemplate) {
                    AppState.currentTemplate = session.currentTemplate;
                }
                if (session.currentTheme) {
                    AppState.currentTheme = session.currentTheme;
                }
                if (session.textStyle) {
                    AppState.textStyle = session.textStyle;
                }
                if (session.cardPadding !== undefined) {
                    AppState.cardPadding = session.cardPadding;
                }
                if (session.currentBgType) {
                    AppState.currentBgType = session.currentBgType;
                }
                if (session.sidebarCollapsed !== undefined) {
                    AppState.sidebarCollapsed = session.sidebarCollapsed;
                }
                
                // UI 상태 복원
                restoreUIState();
                
                // 카드 렌더링
                if (AppState.cards.length > 0) {
                    // 기존 카드에 size 정보가 없으면 현재 기본값으로 설정
                    AppState.cards.forEach(card => {
                        if (!card.size) {
                            card.size = { ...AppState.currentCardSize };
                        }
                    });
                    renderCard(AppState.cards[0]);
                    updateCardInfo();
                }
                
                // 메시지 복원
                if (AppState.messages.length > 0) {
                    renderTextBlocks();
                    updateMessageCount();
                }
            }
        } catch (error) {
            console.error('세션 복원 실패:', error);
        }
    }
}

// UI 상태 복원 함수
function restoreUIState() {
    // 템플릿 버튼 상태 복원
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${AppState.currentTemplate}'`)) {
            btn.classList.add('active');
        }
    });
    
    // 사이즈 버튼 상태 복원
    updateSizeButtonState(AppState.currentCardSize.width, AppState.currentCardSize.height);
    
    // 배경 탭 상태 복원
    document.querySelectorAll('.bg-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.bg-tab[onclick*="${AppState.currentBgType}"]`)?.classList.add('active');
    
    // 기타 UI 요소들 복원
    const paddingSlider = document.getElementById('cardPadding');
    const paddingValue = document.getElementById('paddingValue');
    if (paddingSlider && paddingValue) {
        paddingSlider.value = AppState.cardPadding;
        paddingValue.textContent = `${AppState.cardPadding}px`;
    }
    
    // 배경 컨트롤 복원
    switchBgType(AppState.currentBgType);
    
    // 사이드바 상태 복원
    const sidebar = document.getElementById('textSidebar');
    if (sidebar && AppState.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
    }
}

function saveProject() {
    const project = {
        cards: AppState.cards,
        messages: AppState.messages,
        rawData: AppState.rawData,
        settings: {
            currentCardSize: AppState.currentCardSize,
            currentTemplate: AppState.currentTemplate,
            currentTheme: AppState.currentTheme,
            textStyle: AppState.textStyle,
            cardPadding: AppState.cardPadding,
            currentBgType: AppState.currentBgType
        },
        version: '1.1'
    };
    
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `bookcard-project-${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    
    showNotification('프로젝트를 저장했습니다.', 'success');
}

async function loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const text = await file.text();
                const project = JSON.parse(text);
                
                AppState.cards = project.cards || [];
                AppState.messages = project.messages || [];
                AppState.rawData = project.rawData || null;
                
                // 설정 복원 (v1.1부터)
                if (project.settings) {
                    AppState.currentCardSize = project.settings.currentCardSize || { width: 400, height: 600 };
                    AppState.currentTemplate = project.settings.currentTemplate || 'default';
                    AppState.currentTheme = project.settings.currentTheme || AppState.currentTheme;
                    AppState.textStyle = project.settings.textStyle || AppState.textStyle;
                    AppState.cardPadding = project.settings.cardPadding || 40;
                    AppState.currentBgType = project.settings.currentBgType || 'solid';
                }
                
                // 기존 카드에 size 정보가 없으면 현재 설정으로 보완
                AppState.cards.forEach(card => {
                    if (!card.size) {
                        card.size = { ...AppState.currentCardSize };
                    }
                });
                
                // UI 상태 복원
                restoreUIState();
                
                if (AppState.cards.length > 0) {
                    AppState.currentCardIndex = 0;
                    renderCard(AppState.cards[0]);
                    updateCardInfo();
                }
                
                if (AppState.messages.length > 0) {
                    renderTextBlocks();
                    updateMessageCount();
                }
                
                showNotification('프로젝트를 불러왔습니다.', 'success');
            } catch (error) {
                showNotification('프로젝트 파일을 읽을 수 없습니다.', 'error');
            }
        }
    };
    
    input.click();
}

// 유틸리티 함수들
function updateMessageCount() {
    document.getElementById('messageCount').textContent = AppState.messages.length;
}

function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// 디바운싱 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 디바운싱된 세션 저장
const debouncedSaveSession = debounce(saveSession, 1000);

// 에러 처리 강화
function safeExecute(func, errorMessage = '작업 중 오류가 발생했습니다.') {
    try {
        return func();
    } catch (error) {
        console.error('Error:', error);
        showNotification(errorMessage, 'error');
        return null;
    }
}

function toggleSection(button) {
    const section = button.closest('.panel-section');
    const content = section.querySelector('.section-content');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = '−';
    } else {
        content.style.display = 'none';
        button.textContent = '+';
    }
}

// 드래그 앤 드롭
function setupDragAndDrop() {
    const dropZone = document.querySelector('.file-drop-zone');
    
    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    });
    
    dropZone?.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
    });
    
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/json') {
            loadFromFile({ target: { files: [file] } });
        }
    });
}

// 키보드 단축키
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 편집 중일 때는 단축키 무시
        const isEditing = document.querySelector('[contenteditable="true"]:focus') || 
                         document.activeElement.tagName === 'INPUT' || 
                         document.activeElement.tagName === 'TEXTAREA';
        
        // Ctrl/Cmd + S: 저장
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            exportCard();
        }
        
        // Ctrl/Cmd + A: 전체 선택 (텍스트 블록 영역에서)
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            if (document.activeElement.closest('.text-blocks-container')) {
                e.preventDefault();
                selectAllBlocks();
            }
        }
        
        // Ctrl/Cmd + Z: 되돌리기 (추후 구현 가능)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            // 향후 되돌리기 기능 구현 시 사용
            e.preventDefault();
        }
        
        // 편집 중이 아닐 때만 네비게이션 단축키 활성화
        if (!isEditing) {
            // 좌우 화살표: 카드 네비게이션
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousCard();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextCard();
            }
            
            // 스페이스: 사이드바 토글
            if (e.key === ' ') {
                e.preventDefault();
                toggleTextSidebar();
            }
            
            // Escape: 선택 해제
            if (e.key === 'Escape') {
                clearBlockSelection();
            }
            
            // Enter: 새 카드 추가
            if (e.key === 'Enter') {
                e.preventDefault();
                addNewCard();
            }
        }
    });
}

// 누락된 배경 관련 함수들
function switchBgType(type) {
    // 탭 상태 업데이트
    document.querySelectorAll('.bg-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.bg-tab[onclick*="${type}"]`)?.classList.add('active');
    
    // 콘텐츠 표시/숨김
    document.querySelectorAll('.bg-content').forEach(content => content.style.display = 'none');
    const targetContent = document.getElementById(`bg${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    AppState.currentBgType = type;
    
    // 현재 카드 업데이트
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.theme = { ...AppState.currentTheme };
        renderCard(current);
    }
}

function updateBackground() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) return;
    
    safeExecute(() => {
        switch (AppState.currentBgType) {
            case 'solid':
                AppState.currentTheme.background = document.getElementById('bgColor').value;
                break;
            case 'gradient':
                AppState.currentTheme.gradient[0] = document.getElementById('gradColor1').value;
                AppState.currentTheme.gradient[1] = document.getElementById('gradColor2').value;
                AppState.currentTheme.gradientAngle = parseInt(document.getElementById('gradAngle').value);
                break;
            case 'pattern':
                AppState.currentTheme.pattern = document.getElementById('patternType').value;
                AppState.currentTheme.patternColor = document.getElementById('patternColor').value;
                break;
        }
        
        current.theme = { ...AppState.currentTheme };
        renderCard(current);
        debouncedSaveSession();
    }, '배경 업데이트 중 오류가 발생했습니다.');
}

function updateTextStyle() {
    const current = AppState.cards[AppState.currentCardIndex];
    if (!current) return;
    
    safeExecute(() => {
        AppState.textStyle.fontFamily = document.getElementById('fontFamily').value;
        AppState.textStyle.fontSize = parseInt(document.getElementById('fontSize').value);
        AppState.textStyle.color = document.getElementById('textColor').value;
        AppState.textStyle.lineHeight = parseFloat(document.getElementById('lineHeight').value);
        
        // 폰트 크기 값 표시 업데이트
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeValue) {
            fontSizeValue.textContent = `${AppState.textStyle.fontSize}px`;
        }
        
        current.textStyle = { ...AppState.textStyle };
        renderCard(current);
        debouncedSaveSession();
    }, '텍스트 스타일 업데이트 중 오류가 발생했습니다.');
}

function loadBackgroundImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('이미지 파일만 업로드할 수 있습니다.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        AppState.currentTheme.imageUrl = e.target.result;
        updateBackground();
        showNotification('배경 이미지가 업로드되었습니다.', 'success');
    };
    reader.onerror = () => {
        showNotification('이미지 업로드에 실패했습니다.', 'error');
    };
    reader.readAsDataURL(file);
}

// 사이드바 토글 기능
function toggleTextSidebar() {
    const sidebar = document.getElementById('textSidebar');
    sidebar.classList.toggle('collapsed');
    
    // 상태 저장
    AppState.sidebarCollapsed = sidebar.classList.contains('collapsed');
    debouncedSaveSession();
}

// 텍스트 오버플로우 처리 (하이브리드 방식)
function handleTextOverflow(card) {
    if (!card || !card.content) return;
    
    // 임시 요소로 텍스트 크기 측정
    const tempCard = createTempCardForMeasurement(card);
    if (!tempCard) return;
    
    const textElement = tempCard.querySelector('.card-text');
    const cardContent = tempCard.querySelector('.card-content');
    
    if (!textElement || !cardContent) {
        document.body.removeChild(tempCard);
        return;
    }
    
    // 1단계: 스마트 폰트 크기 조정
    const originalFontSize = card.textStyle?.fontSize || 16;
    let currentFontSize = originalFontSize;
    const minFontSize = 12;
    
    // 텍스트가 오버플로우되는지 확인
    while (currentFontSize >= minFontSize && isTextOverflowing(textElement, cardContent)) {
        currentFontSize -= 1;
        textElement.style.fontSize = `${currentFontSize}px`;
    }
    
    // 2단계: 동적 여백 조정
    let currentPadding = card.padding || 40;
    const minPadding = 20;
    
    while (currentPadding >= minPadding && isTextOverflowing(textElement, cardContent)) {
        currentPadding -= 5;
        cardContent.style.padding = `${currentPadding}px`;
    }
    
    // 3단계: 여전히 오버플로우면 경고 표시
    const isOverflowing = isTextOverflowing(textElement, cardContent);
    
    // 결과 적용
    if (currentFontSize !== originalFontSize) {
        card.textStyle = { ...card.textStyle, fontSize: currentFontSize };
        showNotification(`텍스트 크기를 ${currentFontSize}px로 자동 조정했습니다.`, 'info');
    }
    
    if (currentPadding !== (card.padding || 40)) {
        card.padding = currentPadding;
        showNotification(`여백을 ${currentPadding}px로 자동 조정했습니다.`, 'info');
    }
    
    if (isOverflowing) {
        showOverflowWarning(card);
    }
    
    // 임시 요소 제거
    document.body.removeChild(tempCard);
}

// 텍스트 측정용 임시 카드 생성
function createTempCardForMeasurement(card) {
    const tempCard = createCardElement({
        ...card,
        id: 'temp-measurement'
    });
    
    tempCard.style.position = 'fixed';
    tempCard.style.left = '-9999px';
    tempCard.style.visibility = 'hidden';
    tempCard.style.pointerEvents = 'none';
    
    document.body.appendChild(tempCard);
    return tempCard;
}

// 텍스트 오버플로우 확인
function isTextOverflowing(textElement, containerElement) {
    const textHeight = textElement.scrollHeight;
    const containerHeight = containerElement.clientHeight;
    const footerHeight = 60; // 대략적인 footer 높이
    
    return textHeight > (containerHeight - footerHeight);
}

// 오버플로우 경고 및 옵션 제공
function showOverflowWarning(card) {
    if (confirm('텍스트가 카드 크기를 벗어납니다. 다음 중 선택해주세요:\n\n확인: 텍스트를 여러 카드로 분할\n취소: 현재 상태 유지')) {
        splitTextIntoMultipleCards(card);
    }
}

// 텍스트를 여러 카드로 분할
function splitTextIntoMultipleCards(card) {
    const words = card.content.split(' ');
    const wordsPerCard = Math.ceil(words.length / 2); // 일단 2개로 분할
    
    // 첫 번째 카드 (기존 카드 수정)
    const firstHalf = words.slice(0, wordsPerCard).join(' ');
    card.content = firstHalf;
    
    // 두 번째 카드 생성
    const secondHalf = words.slice(wordsPerCard).join(' ');
    const newCard = {
        id: `card-${Date.now()}`,
        content: secondHalf,
        title: card.title,
        author: card.author,
        ratio: card.ratio,
        size: { ...card.size },
        theme: { ...card.theme },
        textStyle: { ...card.textStyle },
        padding: card.padding,
        template: card.template
    };
    
    // 현재 카드 다음 위치에 추가
    AppState.cards.splice(AppState.currentCardIndex + 1, 0, newCard);
    
    showNotification('텍스트를 2개의 카드로 분할했습니다.', 'success');
    updateCardInfo();
}

// 카드 삭제 관련 함수들
function removeCurrentCard() {
    if (AppState.cards.length === 0) {
        showNotification('삭제할 카드가 없습니다.', 'info');
        return;
    }
    
    if (confirm('현재 카드를 삭제하시겠습니까?')) {
        // 현재 카드 삭제
        AppState.cards.splice(AppState.currentCardIndex, 1);
        
        // 인덱스 조정
        if (AppState.currentCardIndex >= AppState.cards.length && AppState.cards.length > 0) {
            AppState.currentCardIndex = AppState.cards.length - 1;
        }
        
        // UI 업데이트
        if (AppState.cards.length > 0) {
            renderCard(AppState.cards[AppState.currentCardIndex]);
            updateCardInfo();
        } else {
            // 카드가 모두 없으면 빈 상태 표시
            AppState.currentCardIndex = 0;
            const canvas = document.getElementById('cardCanvas');
            canvas.innerHTML = '<div class="empty-state"><p>+ 버튼을 클릭하여 새 카드를 만드세요</p></div>';
            updateCardInfo();
        }
        
        // 세션 저장
        saveSession();
        showNotification('카드가 삭제되었습니다.', 'success');
    }
}

function clearAllCards() {
    if (AppState.cards.length === 0) {
        showNotification('삭제할 카드가 없습니다.', 'info');
        return;
    }
    
    if (confirm(`모든 카드(${AppState.cards.length}개)를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        // 모든 카드 삭제
        AppState.cards = [];
        AppState.currentCardIndex = 0;
        
        // UI 초기화
        const canvas = document.getElementById('cardCanvas');
        canvas.innerHTML = '<div class="empty-state"><p>+ 버튼을 클릭하여 새 카드를 만드세요</p></div>';
        updateCardInfo();
        
        // 텍스트 블록 선택도 초기화
        clearBlockSelection();
        
        // 세션 저장
        saveSession();
        showNotification('모든 카드가 삭제되었습니다.', 'success');
    }
}

// 제목 업데이트 함수
function updateCardTitle() {
    const titleInput = document.getElementById('cardTitleInput');
    const newTitle = titleInput.value.trim();
    
    if (!newTitle) {
        showNotification('카드 제목을 입력해주세요.', 'error');
        titleInput.value = '제목';
        return;
    }
    
    const current = AppState.cards[AppState.currentCardIndex];
    if (current) {
        current.title = newTitle;
        
        // 화면에 표시된 카드의 제목도 업데이트
        const cardTitleElement = document.querySelector('.card-title');
        if (cardTitleElement) {
            cardTitleElement.textContent = newTitle;
        }
        
        saveSession();
        showNotification('카드 제목이 업데이트되었습니다.', 'success');
    }
}

// 폰트 컨트롤 UI 업데이트 함수
function updateFontControlsUI() {
    const fontFamily = document.getElementById('fontFamily');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const textColor = document.getElementById('textColor');
    const lineHeight = document.getElementById('lineHeight');
    
    if (fontFamily) fontFamily.value = AppState.textStyle.fontFamily;
    if (fontSize) fontSize.value = AppState.textStyle.fontSize;
    if (fontSizeValue) fontSizeValue.textContent = `${AppState.textStyle.fontSize}px`;
    if (textColor) textColor.value = AppState.textStyle.color;
    if (lineHeight) lineHeight.value = AppState.textStyle.lineHeight;
    
    // 텍스트 정렬 버튼 업데이트
    document.querySelectorAll('.align-btn').forEach(btn => btn.classList.remove('active'));
    const alignBtn = document.querySelector(`.align-btn[onclick*="${AppState.textStyle.align}"]`);
    if (alignBtn) alignBtn.classList.add('active');
}