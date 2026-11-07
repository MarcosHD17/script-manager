// Controles del popup.

export function toggleButton(state, title, onClick) {
  const button = document.createElement('button');
  button.className = `tgl ${state}`;
  button.textContent = state === 'all' ? 'ON' : state === 'some' ? 'MIX' : 'OFF';
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}
