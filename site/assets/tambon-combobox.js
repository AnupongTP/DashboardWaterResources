(function (global) {
  'use strict';

  const DEFAULT_ERROR = 'กรุณาเลือกตำบลจากรายการที่กำหนด';
  let instanceCounter = 0;

  function resolveElement(value, name) {
    const el = typeof value === 'string' ? document.querySelector(value) : value;
    if (!el) throw new Error('TambonCombobox: missing element ' + name);
    return el;
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim().normalize('NFC');
  }

  function uniqueOrdered(items) {
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach(function (value) {
      const text = normalizeText(value);
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function create(options) {
    options = options || {};
    const input = resolveElement(options.input, 'input');
    const listbox = resolveElement(options.listbox, 'listbox');
    const clearButton = resolveElement(options.clearButton, 'clearButton');
    const errorElement = resolveElement(options.errorElement, 'errorElement');
    const wrapper = input.closest('.tambon-combobox') || input.parentElement;
    const instanceId = ++instanceCounter;

    let items = uniqueOrdered(options.items || []);
    let filteredItems = items.slice();
    let selectedValue = '';
    let activeIndex = -1;
    let open = false;
    let disabled = false;
    let blurTimer = null;

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-controls', listbox.id);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    listbox.setAttribute('role', 'listbox');

    function emit(value, meta) {
      if (typeof options.onChange === 'function') {
        options.onChange(value, meta || {});
      }
    }

    function setInvalid(isInvalid, message) {
      const invalid = !!isInvalid;
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      wrapper.classList.toggle('is-invalid', invalid);
      errorElement.textContent = invalid ? (message || options.errorMessage || DEFAULT_ERROR) : '';
      errorElement.hidden = !invalid;
    }

    function updateClearVisibility() {
      clearButton.hidden = disabled || (!input.value && !selectedValue);
    }

    function closeList() {
      open = false;
      activeIndex = -1;
      listbox.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function setActive(index) {
      if (!open || !filteredItems.length) {
        activeIndex = -1;
        input.removeAttribute('aria-activedescendant');
        return;
      }
      const max = filteredItems.length - 1;
      activeIndex = Math.max(0, Math.min(index, max));
      Array.from(listbox.querySelectorAll('[role="option"]')).forEach(function (node, i) {
        const active = i === activeIndex;
        node.classList.toggle('is-active', active);
        node.setAttribute('aria-selected', active ? 'true' : 'false');
        if (active) {
          input.setAttribute('aria-activedescendant', node.id);
          node.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function matchesQuery(item, query) {
      return item.includes(query);
    }

    function filterForQuery(query) {
      const q = normalizeText(query);
      if (!q) return items.slice();
      const starts = [];
      const contains = [];
      items.forEach(function (item) {
        if (!matchesQuery(item, q)) return;
        if (item.startsWith(q)) starts.push(item);
        else contains.push(item);
      });
      return starts.concat(contains);
    }

    function selectValue(value, source) {
      const normalized = normalizeText(value);
      if (!items.includes(normalized)) return false;
      const changed = selectedValue !== normalized;
      selectedValue = normalized;
      input.value = normalized;
      setInvalid(false);
      updateClearVisibility();
      closeList();
      if (changed || source === 'user') emit(selectedValue, { source: source || 'user', valid: true });
      return true;
    }

    function itemMeta(item) {
      if (typeof options.itemMeta !== 'function') return '';
      return normalizeText(options.itemMeta(item));
    }

    function renderList(query) {
      filteredItems = filterForQuery(query);
      listbox.innerHTML = '';

      if (!filteredItems.length) {
        const empty = document.createElement('div');
        empty.className = 'tambon-combobox-empty';
        empty.textContent = 'ไม่พบตำบลในรายการที่กำหนด';
        empty.setAttribute('role', 'status');
        listbox.appendChild(empty);
      } else {
        filteredItems.forEach(function (item, index) {
          const option = document.createElement('div');
          option.id = listbox.id + '-option-' + instanceId + '-' + index;
          option.className = 'tambon-combobox-option';
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.dataset.value = item;
          const meta = itemMeta(item);
          if (meta) {
            option.classList.add('has-scope');
            option.dataset.scope = meta;
            option.setAttribute('aria-label', item + ' ' + meta);

            const name = document.createElement('span');
            name.className = 'tambon-combobox-option-name';
            name.textContent = item;
            const scope = document.createElement('span');
            scope.className = 'tambon-combobox-option-scope';
            scope.textContent = meta;
            option.appendChild(name);
            option.appendChild(scope);
          } else {
            option.textContent = item;
          }
          option.addEventListener('mousedown', function (event) {
            // Keep focus on the input so mobile/desktop click selection is not lost to blur timing.
            event.preventDefault();
          });
          option.addEventListener('click', function () {
            selectValue(item, 'user');
          });
          listbox.appendChild(option);
        });
      }

      if (!disabled) {
        open = true;
        listbox.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      }
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
    }

    function openList() {
      if (disabled) return;
      renderList(input.value);
    }

    function clearSelection(source, clearText) {
      const hadValue = !!selectedValue;
      const hadText = !!normalizeText(input.value);
      selectedValue = '';
      if (clearText !== false) input.value = '';
      setInvalid(false);
      updateClearVisibility();
      if ((hadValue || hadText) && source) emit('', { source: source, valid: true });
    }

    input.addEventListener('focus', function () {
      clearTimeout(blurTimer);
      openList();
    });

    input.addEventListener('click', function () {
      if (!open) openList();
    });

    input.addEventListener('input', function () {
      const previous = selectedValue;
      selectedValue = '';
      setInvalid(false);
      updateClearVisibility();
      if (previous) emit('', { source: 'edit', valid: true });
      renderList(input.value);
    });

    input.addEventListener('keydown', function (event) {
      if (disabled) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!open) renderList(input.value);
        if (filteredItems.length) setActive(activeIndex < 0 ? 0 : (activeIndex + 1) % filteredItems.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) renderList(input.value);
        if (filteredItems.length) setActive(activeIndex < 0 ? filteredItems.length - 1 : (activeIndex - 1 + filteredItems.length) % filteredItems.length);
        return;
      }

      if (event.key === 'Enter') {
        if (open && activeIndex >= 0 && filteredItems[activeIndex]) {
          event.preventDefault();
          selectValue(filteredItems[activeIndex], 'user');
        } else if (open && filteredItems.length === 1) {
          // Enter with exactly one recommendation is an explicit selection from the allowed list.
          event.preventDefault();
          selectValue(filteredItems[0], 'user');
        }
        return;
      }

      if (event.key === 'Escape') {
        if (open) {
          event.preventDefault();
          closeList();
        }
      }
    });

    input.addEventListener('blur', function () {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(function () {
        closeList();
        const text = normalizeText(input.value);
        if (text && !selectedValue) {
          setInvalid(true);
        } else {
          setInvalid(false);
        }
      }, 120);
    });

    clearButton.addEventListener('mousedown', function (event) {
      event.preventDefault();
    });
    clearButton.addEventListener('click', function () {
      clearSelection('clear', true);
      input.focus();
      renderList('');
    });

    function setItems(nextItems, config) {
      const cfg = config || {};
      items = uniqueOrdered(nextItems);
      const current = selectedValue;
      if (current && !items.includes(current)) {
        selectedValue = '';
        input.value = '';
        setInvalid(false);
        updateClearVisibility();
        if (!cfg.silent) emit('', { source: 'scope-change', valid: true });
      }
      if (open) renderList(input.value);
      return items.slice();
    }

    function setValue(value, config) {
      const cfg = config || {};
      const normalized = normalizeText(value);
      if (!normalized) {
        const changed = !!selectedValue || !!input.value;
        selectedValue = '';
        input.value = '';
        setInvalid(false);
        updateClearVisibility();
        closeList();
        if (changed && !cfg.silent) emit('', { source: cfg.source || 'programmatic', valid: true });
        return true;
      }
      if (!items.includes(normalized)) {
        selectedValue = '';
        input.value = '';
        setInvalid(false);
        updateClearVisibility();
        closeList();
        if (!cfg.silent) emit('', { source: cfg.source || 'programmatic-invalid', valid: false });
        return false;
      }
      const changed = selectedValue !== normalized || input.value !== normalized;
      selectedValue = normalized;
      input.value = normalized;
      setInvalid(false);
      updateClearVisibility();
      closeList();
      if (changed && !cfg.silent) emit(normalized, { source: cfg.source || 'programmatic', valid: true });
      return true;
    }

    function setDisabled(value) {
      disabled = !!value;
      input.disabled = disabled;
      clearButton.disabled = disabled;
      wrapper.classList.toggle('is-disabled', disabled);
      if (disabled) closeList();
      updateClearVisibility();
    }

    function validate() {
      const text = normalizeText(input.value);
      const valid = !text || (!!selectedValue && text === selectedValue && items.includes(selectedValue));
      setInvalid(!valid);
      return valid;
    }

    function destroy() {
      closeList();
      // This dashboard creates each combobox once for the page lifetime; explicit listener teardown is unnecessary.
    }

    setInvalid(false);
    updateClearVisibility();

    return Object.freeze({
      setItems,
      setValue,
      getValue: function () { return selectedValue; },
      getItems: function () { return items.slice(); },
      open: openList,
      close: closeList,
      clear: function (config) {
        const cfg = config || {};
        const changed = !!selectedValue || !!input.value;
        selectedValue = '';
        input.value = '';
        setInvalid(false);
        updateClearVisibility();
        closeList();
        if (changed && !cfg.silent) emit('', { source: cfg.source || 'programmatic-clear', valid: true });
      },
      setDisabled,
      validate,
      destroy
    });
  }

  global.TambonCombobox = Object.freeze({ create: create });
})(window);
