// GeneSearch.jsx – Async gene autocomplete using react-select AsyncSelect
import { useState } from 'react'
import AsyncSelect from 'react-select/async'
import { api } from '../api.js'

const customStyles = {
  control: (base, state) => ({
    ...base,
    background: '#0d1526',
    borderColor: state.isFocused ? '#3b82f6' : '#1e293b',
    boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
    borderRadius: '10px',
    minHeight: '36px',
    cursor: 'text',
    '&:hover': { borderColor: '#3b82f6' },
  }),
  input:       (b) => ({ ...b, color: '#e2e8f0', fontSize: '13px' }),
  placeholder: (b) => ({ ...b, color: '#334155', fontSize: '12px' }),
  singleValue: (b) => ({ ...b, color: '#93c5fd', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }),
  menu:        (b) => ({ ...b, background: '#0d1526', border: '1px solid #1e293b', borderRadius: '10px', overflow: 'hidden', zIndex: 9999 }),
  menuList:    (b) => ({ ...b, padding: 4, maxHeight: 220 }),
  option: (b, state) => ({
    ...b,
    background: state.isFocused ? '#1e293b' : 'transparent',
    color: state.isFocused ? '#93c5fd' : '#64748b',
    fontSize: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    padding: '6px 10px',
  }),
  noOptionsMessage: (b) => ({ ...b, color: '#334155', fontSize: '12px' }),
  loadingMessage:   (b) => ({ ...b, color: '#334155', fontSize: '12px' }),
  dropdownIndicator: () => ({ display: 'none' }),
  indicatorSeparator: () => ({ display: 'none' }),
  clearIndicator: (b) => ({ ...b, color: '#334155', padding: '0 6px', cursor: 'pointer', '&:hover': { color: '#e2e8f0' } }),
}

const loadOptions = async (inputValue) => {
  try {
    const { genes } = await api.geneList(inputValue, 60)
    return genes.map(g => ({ value: g, label: g }))
  } catch {
    return []
  }
}

export default function GeneSearch({ onSelect, placeholder = 'Search gene…', value: externalValue }) {
  const [value, setValue] = useState(null)

  const handleChange = (opt) => {
    setValue(opt)
    if (opt) onSelect(opt.value)
    else onSelect(null)
  }

  return (
    <AsyncSelect
      value={value}
      onChange={handleChange}
      loadOptions={loadOptions}
      defaultOptions
      cacheOptions
      isSearchable
      isClearable
      placeholder={placeholder}
      styles={customStyles}
      classNamePrefix="gene-search"
      noOptionsMessage={({ inputValue }) =>
        inputValue.length < 1 ? 'Start typing a gene name…' : `No results for "${inputValue}"`
      }
      loadingMessage={() => 'Searching genes…'}
    />
  )
}
