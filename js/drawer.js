export function addDrawerEventListener() {
    const drawerButton = document.getElementById('drawer-button');
    drawerButton.addEventListener('click', () => {
        handleClick(drawerButton);
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
