// Referencias a elementos de options.html y mensajes de estado.
import { $ } from '../shared/dom.js';

export const els = {
  items: $('items'), name: $('name'), group: $('group'), matches: $('matches'), code: $('code'), enabled: $('enabled'),
  grants: $('grants'), note: $('note'), warning: $('warning'), message: $('message'), sort: $('sortMode'),
  theme: $('themeSelect'), historyList: $('historyList'), historyCount: $('historyCount'), diffView: $('diffView'),
  importFile: $('importFile'), search: $('search'), selectAll: $('selectAll'), selCount: $('selCount'),
  bulkBar: $('bulkBar'), bulkCount: $('bulkCount'), bulkGroup: $('bulkGroup'), bulkOn: $('bulkOn'), bulkOff: $('bulkOff'),
  bulkClear: $('bulkClear'), bulkDelete: $('bulkDelete'), toggleAll: $('toggleAll'),
  groupBar: $('groupBar'), groupBarCount: $('groupBarCount'), font: $('fontSize'), dialog: $('deleteDialog')
};

export function showMessage(text, kind = 'ok') {
  els.message.hidden = false;
  els.message.className = kind;
  els.message.textContent = text;
}
