// Loaded by sfi-grasslands-v4 select-land, select-land-map-fluid-find and select-actions.
// Adds a "View all land parcels" button to the Defra interactive map, in the bottom-left slot.
(function (root) {
  var BUTTON_ID = 'resetMapView';
  var SLOT = { slot: 'bottom-left' };
  var ICON =
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
    '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>';

  function add(interactiveMap, onClick) {
    interactiveMap.addButton(BUTTON_ID, {
      label: 'View all land parcels',
      iconSvgContent: ICON,
      isHidden: true,
      onClick: onClick,
      mobile: SLOT,
      tablet: SLOT,
      desktop: SLOT
    });
  }

  function setVisible(interactiveMap, isVisible) {
    interactiveMap.toggleButtonState(BUTTON_ID, 'hidden', !isVisible);
  }

  root.sfiGrasslandsV4MapResetButton = { add: add, setVisible: setVisible };
})(window);
