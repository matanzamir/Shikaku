export function addDrawerEventListener() {
    const drawerButton = document.getElementById('drawer-button');
    drawerButton.addEventListener('click', () => {
        handleClick(drawerButton);
    });

    const lightDarkButton = document.getElementById('light-dark-button');
    lightDarkButton.addEventListener('click', () => {
        handleLightDarkClick(lightDarkButton);
    });
}

function handleClick(drawerButton) {
    const drawer = drawerButton.parentElement;
    const label = drawerButton.querySelector('.drawer-button');
    drawer.classList.toggle('is-open');
    if (drawer.classList.contains('is-open')) {
        label.textContent = '>';
    } else {
        label.textContent = '<';
    }
}

function handleLightDarkClick(lightDarkButton) {
    const body = document.body;
    body.dataset.theme = body.dataset.theme === 'dark' ? 'light' : 'dark';
    lightDarkButton.textContent = body.dataset.theme === 'dark' ? 'Light Mode' : 'Dark Mode';

}
