(function(global) {
  var codes = [
    'CLIG3',
    'GRH7',
    'GRH8',
    'GRH10',
    'CSAM3',
    'CHRW2',
    'WBD2',
    'HEF1',
    'CNUM2',
    'CIGL2',
    'CIGL1',
    'WBD1',
    'SCR2',
    'BND1',
    'BND2',
    'GRH12'
  ];

  var codeSet = codes.reduce(function(lookup, code) {
    lookup[code] = true;
    return lookup;
  }, {});

  function filterCatalog(actions) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions.filter(function(action) {
      return codeSet[action.code];
    });
  }

  global.GRASSLANDS_V2_MVP_ACTIONS = {
    codes: codes,
    codeSet: codeSet,
    filterCatalog: filterCatalog
  };
})(typeof window !== 'undefined' ? window : this);
