const blessed = require('blessed');
const contrib = require('blessed-contrib');

const testOpts = {
  gridCoords: {
    row: 0,
    col: 0,
    rowSpan: 10.5,
    colSpan: 12
  },
  type: contrib.log,
  args: {
    label: 'Server Tester',
    style: { fg: 'default', bg: 'default', border: { fg: 'magenta', bg: 'default' } },
    bufferLength: 1000,
    tags: 'true',
    name: 'server'
  }
};


const testPlanOpts = {
  gridCoords: {
    row: 0,
    col: 0,
    rowSpan: 10.5,
    colSpan: 12
  },
  type: blessed.log,
  args: {
    label: 'Server Test Plan',
    mouse: true,
    scrollable: true,
    tags: true,
    keys: true,
    vi: true,
    style: { fg: 'default', bg: 'default', border: { fg: 'magenta', bg: 'default' } },
    border: { type: 'line', fg: '#00ff00' },
    hover: { bg: 'blue' },
    scrollbar: { ch: ' ', track: { bg: 'magenta' }, style: { inverse: true } },
    name: 'server'
  }
};


module.exports = { testOpts, testPlanOpts };