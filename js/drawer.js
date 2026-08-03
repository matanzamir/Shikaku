
export function handleDrawerClick(drawerButton) {
    const drawer = drawerButton.parentElement;
    const label = drawerButton.querySelector('.drawer-button');
    drawer.classList.toggle('is-open');
    if (drawer.classList.contains('is-open')) {
        label.textContent = '>';
    } else {
        label.textContent = '<';
    }
}

export function handleInstructionsButtonClick(maxImageIndex) {
    const instructionsloader = document.getElementById('instructions-loader');
    const instructionscontent = document.getElementById('instructions-content');
    instructionsloader.hidden = true;
    instructionscontent.hidden = false;
    const slide = document.getElementById('instructions-slide');
    const img = document.createElement('img');
    img.src = 'assets/instruction-images/1.png';
    img.classList.add('instructions-image');
    img.draggable = false;
    slide.replaceChildren(img);
    buildSlideIndicators(maxImageIndex);
    updateSlideControls(1, maxImageIndex);
}

export function handleSlideLeftButtonClick(maxImageIndex) {
    const instructionsslide = document.getElementById('instructions-slide');
    const currentImage = document.getElementsByClassName('instructions-image')[0];
    const currentImageIndex = getCurrentImageIndex(currentImage.src);
    const newImageIndex = currentImageIndex - 1;
    changeImage(newImageIndex, instructionsslide, currentImage, maxImageIndex);
}

export function handleSlideRightButtonClick(maxImageIndex) {
    const instructionsslide = document.getElementById('instructions-slide');
    const currentImage = document.getElementsByClassName('instructions-image')[0];
    const currentImageIndex = getCurrentImageIndex(currentImage.src);
    const newImageIndex = currentImageIndex + 1;
    changeImage(newImageIndex, instructionsslide, currentImage, maxImageIndex);
}

function changeImage(newImageIndex, instructionsslide, currentImage, maxImageIndex) {
    const newImage = document.createElement('img');
    newImage.src = `assets/instruction-images/${newImageIndex}.png`;
    newImage.classList.add('instructions-image');
    newImage.draggable = false;
    instructionsslide.replaceChildren(newImage);
    updateSlideControls(newImageIndex, maxImageIndex);
}

function buildSlideIndicators(maxImageIndex) {
    const indicators = document.getElementById('slide-indicators');
    indicators.replaceChildren();
    for (let i = 1; i <= maxImageIndex; i++) {
        const dot = document.createElement('span');
        dot.classList.add('slide-dot');
        indicators.appendChild(dot);
    }
}

function updateSlideControls(activeIndex, maxImageIndex) {
    document.getElementById('slide-left').hidden = activeIndex === 1;
    document.getElementById('slide-right').hidden = activeIndex === maxImageIndex;

    const dots = document.querySelectorAll('#slide-indicators .slide-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index + 1 === activeIndex);
    });
}

function getCurrentImageIndex(currentImageSrc) {
    return parseInt(currentImageSrc.split('/').pop().split('.')[0]);
}
