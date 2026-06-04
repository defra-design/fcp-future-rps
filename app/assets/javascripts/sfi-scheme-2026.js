(function(global) {
  var actions = [
    { code: 'AGF1', name: 'Maintain very low density in-field agroforestry on less sensitive land', theme: 'Agroforestry', rateText: '£248/ha' },
    { code: 'AGF2', name: 'Maintain low density in-field agroforestry on less sensitive land', theme: 'Agroforestry', rateText: '£385/ha' },
    { code: 'BND1', name: 'Maintain dry stone walls', theme: 'Boundary Features', rateText: '£27/100m (both sides)' },
    { code: 'BND2', name: 'Maintain earth banks or stone-faced hedgebanks', theme: 'Boundary Features', rateText: '£11/100m (one side)' },
    { code: 'CHRW2', name: 'Manage hedgerows', theme: 'Boundary Features', rateText: '£13/100m (one side)' },
    { code: 'CAHL4', name: '4m to 12m grass buffer strip on arable and horticultural land', theme: 'Buffer Strips', rateText: '£515/ha' },
    { code: 'CIGL3', name: '4m to 12m grass buffer strip on improved grassland', theme: 'Buffer Strips', rateText: '£235/ha' },
    { code: 'BFS1', name: '12m to 24m watercourse buffer strip on cultivated land', theme: 'Buffer Strips', rateText: '£707/ha' },
    { code: 'BFS6', name: '6m to 12m habitat strip next to watercourses', theme: 'Buffer Strips', rateText: '£742/ha' },
    { code: 'AHW2', name: 'Supplementary winter bird food', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£732/t' },
    { code: 'AHW3', name: 'Beetle banks', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£764/ha' },
    { code: 'AHW4', name: 'Skylark plots', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£11/plot (min 2 plots/ha)' },
    { code: 'AHW5', name: 'Nesting plots for lapwing', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£765/ha' },
    { code: 'AHW6', name: 'Basic overwinter stubble', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£58/ha' },
    { code: 'AHW7', name: 'Enhanced overwinter stubble', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£589/ha' },
    { code: 'AHW8', name: 'Whole crop spring cereals and overwinter stubble', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£596/ha' },
    { code: 'AHW9', name: 'Unharvested cereal headland', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£1,072/ha' },
    { code: 'AHW10', name: 'Low input harvested cereal crop', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£354/ha' },
    { code: 'AHW11', name: 'Cultivated areas for arable plants', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£660/ha' },
    { code: 'CAHL1', name: 'Pollen and nectar flower mix', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£739/ha' },
    { code: 'CAHL2', name: 'Winter bird food on arable and horticultural land', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£648/ha' },
    { code: 'CAHL3', name: 'Grassy field corners or blocks', theme: 'Farmland Wildlife - Arable/Horticultural', rateText: '£590/ha' },
    { code: 'CIGL1', name: 'Take grassland field corners or blocks out of management', theme: 'Farmland Wildlife - Grassland', rateText: '£333/ha' },
    { code: 'CIGL2', name: 'Winter bird food on improved grassland', theme: 'Farmland Wildlife - Grassland', rateText: '£515/ha' },
    { code: 'CLIG3', name: 'Manage grassland with very low nutrient inputs', theme: 'Farmland Wildlife - Grassland', rateText: '£151/ha' },
    { code: 'HEF6', name: 'Manage historic and archaeological features on grassland', theme: 'Heritage', rateText: '£55/ha' },
    { code: 'HEF1', name: 'Maintain weatherproof traditional farm or forestry buildings', theme: 'Heritage', rateText: '£5/sq m' },
    { code: 'CIPM2', name: 'Flower-rich grass margins, blocks or in-field strips', theme: 'Integrated Pest Management', rateText: '£798/ha' },
    { code: 'CIPM3', name: 'Companion crop on arable and horticultural land', theme: 'Integrated Pest Management', rateText: '£55/ha' },
    { code: 'CIPM4', name: 'No use of insecticide on arable crops and permanent crops', theme: 'Integrated Pest Management', rateText: '£45/ha' },
    { code: 'UPL1', name: 'Moderate livestock grazing on moorland', theme: 'Moorland', rateText: '£35/ha' },
    { code: 'UPL2', name: 'Low livestock grazing on moorland', theme: 'Moorland', rateText: '£89/ha' },
    { code: 'UPL3', name: 'Limited livestock grazing on moorland', theme: 'Moorland', rateText: '£111/ha' },
    { code: 'UPL5', name: 'Keep cattle and ponies on moorland supplement (minimum 70% GLU)', theme: 'Moorland', rateText: '£18/ha' },
    { code: 'UPL6', name: 'Keep cattle and ponies on moorland supplement (100% GLU)', theme: 'Moorland', rateText: '£23/ha' },
    { code: 'UPL8', name: 'Shepherding livestock on moorland (remove stock for at least 4 months)', theme: 'Moorland', rateText: '£74/ha' },
    { code: 'UPL10', name: 'Shepherding livestock on moorland (remove stock for at least 8 months)', theme: 'Moorland', rateText: '£102/ha' },
    { code: 'CNUM2', name: 'Legumes on improved grassland', theme: 'Nutrient Management', rateText: '£102/ha' },
    { code: 'CNUM3', name: 'Legume fallow', theme: 'Nutrient Management', rateText: '£532/ha' },
    { code: 'OFC1', name: 'Organic conversion - improved permanent grassland', theme: 'Organic', rateText: '£187/ha' },
    { code: 'OFC2', name: 'Organic conversion - unimproved permanent grassland', theme: 'Organic', rateText: '£96/ha' },
    { code: 'OFC3', name: 'Organic conversion - rotational land', theme: 'Organic', rateText: '£298/ha' },
    { code: 'OFC4', name: 'Organic conversion - horticultural land', theme: 'Organic', rateText: '£874/ha' },
    { code: 'OFC5', name: 'Organic conversion - top fruit', theme: 'Organic', rateText: '£1,920/ha' },
    { code: 'OFM1', name: 'Organic land management - improved permanent grassland', theme: 'Organic', rateText: '£20/ha' },
    { code: 'OFM2', name: 'Organic land management - unimproved permanent grassland', theme: 'Organic', rateText: '£41/ha' },
    { code: 'OFM3', name: 'Organic land management - enclosed rough grazing', theme: 'Organic', rateText: '£97/ha' },
    { code: 'OFM4', name: 'Organic land management - rotational land', theme: 'Organic', rateText: '£132/ha' },
    { code: 'OFM5', name: 'Organic land management - horticultural land', theme: 'Organic', rateText: '£707/ha' },
    { code: 'OFM6', name: 'Organic land management - top fruit', theme: 'Organic', rateText: '£1,920/ha' },
    { code: 'PRF1', name: 'Variable rate application of nutrients', theme: 'Precision Farming', rateText: '£27/ha' },
    { code: 'PRF2', name: 'Camera or remote sensor guided herbicide spraying', theme: 'Precision Farming', rateText: '£43/ha' },
    { code: 'PRF4', name: 'Mechanical robotic weeding', theme: 'Precision Farming', rateText: '£150/ha' },
    { code: 'CSAM2', name: 'Multi-species winter cover crop', theme: 'Soil Health', rateText: '£129/ha' },
    { code: 'CSAM3', name: 'Herbal leys', theme: 'Soil Health', rateText: '£224/ha' },
    { code: 'SOH1', name: 'No-till farming', theme: 'Soil Health', rateText: '£73/ha' },
    { code: 'SOH3', name: 'Multi-species summer-sown cover crop', theme: 'Soil Health', rateText: '£163/ha' },
    { code: 'SCR1', name: 'Create scrub and open habitat mosaics', theme: 'Species Recovery/Management', rateText: '£588/ha' },
    { code: 'SCR2', name: 'Manage scrub and open habitat mosaics', theme: 'Species Recovery/Management', rateText: '£350/ha' },
    { code: 'SPM3', name: 'Keep native breeds on grazed habitats supplement (more than 80%)', theme: 'Species Recovery/Management', rateText: '£146/ha' },
    { code: 'SPM5', name: 'Keep native breeds on extensively managed habitats supplement (more than 80%)', theme: 'Species Recovery/Management', rateText: '£11/ha' },
    { code: 'WBD1', name: 'Manage ponds', theme: 'Waterbodies', rateText: '£257/pond' },
    { code: 'WBD2', name: 'Manage ditches', theme: 'Waterbodies', rateText: '£4/100m (both sides)' },
    { code: 'WBD3', name: 'In-field grass strips', theme: 'Waterbodies', rateText: '£765/ha' },
    { code: 'WBD4', name: 'Arable reversion to grassland with low fertiliser input', theme: 'Waterbodies', rateText: '£489/ha' },
    { code: 'WBD6', name: 'Remove livestock from intensive grassland during autumn & winter (outside SDAs)', theme: 'Waterbodies', rateText: '£115/ha' },
    { code: 'WBD7', name: 'Remove livestock from grassland during autumn & winter (SDAs)', theme: 'Waterbodies', rateText: '£115/ha' },
    { code: 'GRH12', name: 'Manage rough grassland for upland breeding waders', theme: 'Farmland Wildlife - Grassland', rateText: '£203/ha' },
    { code: 'GRH7', name: 'Haymaking supplement', theme: 'Farmland Wildlife - Grassland', rateText: '£157/ha' },
    { code: 'GRH8', name: 'Haymaking supplement (late cut)', theme: 'Farmland Wildlife - Grassland', rateText: '£187/ha' },
    { code: 'GRH10', name: 'Lenient grazing supplement', theme: 'Farmland Wildlife - Grassland', rateText: '£28/ha' },
  ];

  var guidanceUrlOverrides = {
    AGF1: 'https://www.gov.uk/find-funding-for-land-or-farms/cagf4-manage-very-low-density-in-field-agroforestry-on-more-sensitive-land'
  };

  function slugifyGuidanceValue(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function getActionGuidanceUrl(action, overrides) {
    var code = (action && action.code ? String(action.code) : '').toUpperCase();
    var mergedOverrides = overrides || guidanceUrlOverrides;
    if (!code) {
      return 'https://www.gov.uk/find-funding-for-land-or-farms';
    }

    if (mergedOverrides[code]) {
      return mergedOverrides[code];
    }

    var nameSlug = slugifyGuidanceValue(action && action.name ? action.name : '');
    if (!nameSlug) {
      return 'https://www.gov.uk/find-funding-for-land-or-farms';
    }

    return 'https://www.gov.uk/find-funding-for-land-or-farms/' + code.toLowerCase() + '-' + nameSlug;
  }

  global.SFI_SCHEME_2026 = {
    actions: actions,
    guidanceUrlOverrides: guidanceUrlOverrides,
    getActionGuidanceUrl: getActionGuidanceUrl
  };
})(window);
