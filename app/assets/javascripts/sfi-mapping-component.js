/**
 * SFI Mapping Component for Land Parcel Selection and Action Assignment
 * 
 * Features:
 * - Interactive map with land parcel selection
 * - SFI action assignment to selected parcels
 * - Multi-select with bulk action assignment
 * - Parcel eligibility checking
 * - Action conflict detection
 * - Real-time payment calculations
 * - Accessibility compliant
 */

window.GOVUKPrototypeKit.documentReady(() => {
  
  class SFIMappingComponent {
    constructor(containerSelector, options = {}) {
      this.container = document.querySelector(containerSelector);
      if (!this.container) return;
      
      this.options = {
        zoom: options.zoom || 1,
        maxZoom: options.maxZoom || 3,
        minZoom: options.minZoom || 0.5,
        enableEditing: options.enableEditing !== false,
        showActionPanel: options.showActionPanel !== false,
        showPaymentCalculator: options.showPaymentCalculator !== false,
        ...options
      };
      
      this.selectedParcels = new Set();
      this.parcelActions = new Map(); // Map of parcelId -> [actions]
      this.parcels = options.parcels || this.generateSampleParcels();
      this.sfiActions = options.sfiActions || this.getSFIActions();
      this.currentZoom = this.options.zoom;
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.mapOffset = { x: 0, y: 0 };
      this.editMode = false;
      
      this.init();
    }
    
    init() {
      this.createMapStructure();
      this.createControls();
      this.createActionPanel();
      this.createPaymentCalculator();
      this.renderParcels();
      this.bindEvents();
      this.updateSelectionInfo();
    }
    
    getSFIActions() {
      return [
        {
          id: 'NUM3',
          name: 'Herbal leys',
          code: 'NUM3',
          payment: 382,
          unit: 'per hectare per year',
          description: 'Establish and maintain herbal leys',
          eligibleLandUse: ['Arable', 'Grassland'],
          minArea: 0.25,
          maxArea: null,
          color: '#00703c'
        },
        {
          id: 'AHL2',
          name: 'Flower-rich grass margins, blocks or in-field strips',
          code: 'AHL2',
          payment: 798,
          unit: 'per hectare per year',
          description: 'Create and maintain flower-rich margins and strips',
          eligibleLandUse: ['Arable', 'Grassland'],
          minArea: 0.25,
          maxArea: 50,
          color: '#f47738'
        },
        {
          id: 'IPM2',
          name: 'No use of insecticides on arable crops and permanent crops',
          code: 'IPM2',
          payment: 45,
          unit: 'per hectare per year',
          description: 'Avoid using insecticides on crops',
          eligibleLandUse: ['Arable'],
          minArea: 1,
          maxArea: null,
          color: '#1d70b8'
        },
        {
          id: 'SAM2',
          name: 'Assess soil, produce a soil management plan and test soil organic matter',
          code: 'SAM2',
          payment: 58,
          unit: 'per hectare per year',
          description: 'Comprehensive soil assessment and management',
          eligibleLandUse: ['Arable', 'Grassland', 'Pasture'],
          minArea: 5,
          maxArea: null,
          color: '#801650'
        },
        {
          id: 'LIG1',
          name: 'Take grassland field corners or blocks out of management',
          code: 'LIG1',
          payment: 590,
          unit: 'per hectare per year',
          description: 'Create unmanaged grassland areas for wildlife',
          eligibleLandUse: ['Grassland', 'Pasture'],
          minArea: 0.25,
          maxArea: 10,
          color: '#6f72af'
        }
      ];
    }
    
    createMapStructure() {
      this.container.innerHTML = `
        <div class="sfi-mapping-component" role="application" aria-label="SFI land parcel mapping and action assignment">
          
          <div class="sfi-mapping-component__header">
            <div class="govuk-grid-row">
              <div class="govuk-grid-column-two-thirds">
                <h2 class="govuk-heading-m">Select parcels and assign SFI actions</h2>
                <p class="govuk-body">Click on parcels to select them, then choose which SFI actions to apply.</p>
              </div>
              <div class="govuk-grid-column-one-third">
                <div class="sfi-mapping-component__mode-toggle">
                  <button class="govuk-button govuk-button--secondary sfi-mapping-component__edit-toggle" type="button">
                    Enable edit mode
                  </button>
                </div>
              </div>
            </div>
            
            <div class="sfi-mapping-component__search">
              <div class="govuk-form-group">
                <label class="govuk-label govuk-label--s" for="sfi-parcel-search">
                  Search for a parcel
                </label>
                <input class="govuk-input govuk-input--width-20" id="sfi-parcel-search" name="sfi-parcel-search" type="text" placeholder="Enter parcel ID or name">
              </div>
            </div>
          </div>
          
          <div class="sfi-mapping-component__main">
            <div class="sfi-mapping-component__map-container">
              <div class="sfi-mapping-component__controls">
                <button class="govuk-button govuk-button--secondary sfi-mapping-component__zoom-in" type="button" aria-label="Zoom in">
                  <span aria-hidden="true">+</span>
                </button>
                <button class="govuk-button govuk-button--secondary sfi-mapping-component__zoom-out" type="button" aria-label="Zoom out">
                  <span aria-hidden="true">−</span>
                </button>
                <button class="govuk-button govuk-button--secondary sfi-mapping-component__reset" type="button">
                  Reset view
                </button>
              </div>
              
              <div class="sfi-mapping-component__map" tabindex="0" role="img" aria-label="Farm parcel map for SFI action assignment">
                <svg class="sfi-mapping-component__svg" viewBox="0 0 900 700">
                  <defs>
                    <pattern id="sfi-field-pattern" patternUnits="userSpaceOnUse" width="4" height="4">
                      <rect width="4" height="4" fill="#00703c" opacity="0.1"/>
                      <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke="#00703c" stroke-width="0.5" opacity="0.3"/>
                    </pattern>
                  </defs>
                  <g class="sfi-mapping-component__parcels-group"></g>
                </svg>
                
                <div class="sfi-mapping-component__parcel-info" style="display: none;">
                  <div class="sfi-mapping-component__info-content">
                    <h3 class="govuk-heading-s" id="sfi-info-title"></h3>
                    <dl class="govuk-summary-list govuk-summary-list--no-border">
                      <div class="govuk-summary-list__row">
                        <dt class="govuk-summary-list__key">Size</dt>
                        <dd class="govuk-summary-list__value" id="sfi-info-size"></dd>
                      </div>
                      <div class="govuk-summary-list__row">
                        <dt class="govuk-summary-list__key">Land use</dt>
                        <dd class="govuk-summary-list__value" id="sfi-info-landuse"></dd>
                      </div>
                      <div class="govuk-summary-list__row">
                        <dt class="govuk-summary-list__key">Current actions</dt>
                        <dd class="govuk-summary-list__value" id="sfi-info-actions"></dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="sfi-mapping-component__sidebar">
              
              <!-- Selection Panel -->
              <div class="sfi-mapping-component__selection-panel">
                <h3 class="govuk-heading-s">Selected parcels (<span id="sfi-selected-count">0</span>)</h3>
                <div class="sfi-mapping-component__selected-list" id="sfi-selected-list">
                  <p class="govuk-hint">No parcels selected</p>
                </div>
                <div class="sfi-mapping-component__selection-actions" style="display: none;">
                  <button class="govuk-button govuk-button--warning sfi-mapping-component__clear-selection" type="button">
                    Clear selection
                  </button>
                </div>
              </div>
              
              <!-- Action Assignment Panel -->
              <div class="sfi-mapping-component__action-panel" style="display: ${this.options.showActionPanel ? 'block' : 'none'}">
                <h3 class="govuk-heading-s">Assign SFI actions</h3>
                <div class="sfi-mapping-component__action-content" id="sfi-action-content">
                  <p class="govuk-hint">Select parcels to assign actions</p>
                </div>
              </div>
              
              <!-- Payment Calculator -->
              <div class="sfi-mapping-component__payment-calculator" style="display: ${this.options.showPaymentCalculator ? 'block' : 'none'}">
                <h3 class="govuk-heading-s">Payment summary</h3>
                <div class="sfi-mapping-component__payment-content" id="sfi-payment-content">
                  <div class="govuk-summary-list">
                    <div class="govuk-summary-list__row">
                      <dt class="govuk-summary-list__key">Total annual payment</dt>
                      <dd class="govuk-summary-list__value" id="sfi-total-payment">£0</dd>
                    </div>
                    <div class="govuk-summary-list__row">
                      <dt class="govuk-summary-list__key">Total area with actions</dt>
                      <dd class="govuk-summary-list__value" id="sfi-total-area">0 hectares</dd>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Legend -->
              <div class="sfi-mapping-component__legend">
                <h3 class="govuk-heading-s">Legend</h3>
                <ul class="govuk-list">
                  <li class="sfi-mapping-component__legend-item">
                    <span class="sfi-mapping-component__legend-icon sfi-mapping-component__legend-icon--available"></span>
                    Available for selection
                  </li>
                  <li class="sfi-mapping-component__legend-item">
                    <span class="sfi-mapping-component__legend-icon sfi-mapping-component__legend-icon--selected"></span>
                    Selected
                  </li>
                  <li class="sfi-mapping-component__legend-item">
                    <span class="sfi-mapping-component__legend-icon sfi-mapping-component__legend-icon--has-actions"></span>
                    Has SFI actions
                  </li>
                  <li class="sfi-mapping-component__legend-item">
                    <span class="sfi-mapping-component__legend-icon sfi-mapping-component__legend-icon--ineligible"></span>
                    Not eligible
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    createControls() {
      this.zoomInBtn = this.container.querySelector('.sfi-mapping-component__zoom-in');
      this.zoomOutBtn = this.container.querySelector('.sfi-mapping-component__zoom-out');
      this.resetBtn = this.container.querySelector('.sfi-mapping-component__reset');
      this.editToggleBtn = this.container.querySelector('.sfi-mapping-component__edit-toggle');
      this.mapElement = this.container.querySelector('.sfi-mapping-component__map');
      this.svgElement = this.container.querySelector('.sfi-mapping-component__svg');
      this.parcelsGroup = this.container.querySelector('.sfi-mapping-component__parcels-group');
      this.searchInput = this.container.querySelector('#sfi-parcel-search');
    }
    
    createActionPanel() {
      this.actionContent = this.container.querySelector('#sfi-action-content');
      this.selectedList = this.container.querySelector('#sfi-selected-list');
      this.selectedCount = this.container.querySelector('#sfi-selected-count');
      this.clearSelectionBtn = this.container.querySelector('.sfi-mapping-component__clear-selection');
      this.selectionActions = this.container.querySelector('.sfi-mapping-component__selection-actions');
    }
    
    createPaymentCalculator() {
      this.paymentContent = this.container.querySelector('#sfi-payment-content');
      this.totalPayment = this.container.querySelector('#sfi-total-payment');
      this.totalArea = this.container.querySelector('#sfi-total-area');
    }
    
    generateSampleParcels() {
      const parcels = [];
      const landUses = ['Arable', 'Grassland', 'Woodland', 'Pasture'];
      
      for (let i = 0; i < 15; i++) {
        const landUse = landUses[Math.floor(Math.random() * landUses.length)];
        const size = Math.random() * 45 + 5;
        
        parcels.push({
          id: `SFI${String(i + 1).padStart(3, '0')}`,
          name: `Field ${i + 1}`,
          size: size.toFixed(1),
          landUse: landUse,
          eligible: landUse !== 'Woodland', // Woodland typically not eligible for most SFI actions
          coordinates: this.generateParcelCoordinates(i)
        });
      }
      
      return parcels;
    }
    
    generateParcelCoordinates(index) {
      const cols = 5;
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      const centerX = 120 + col * 140 + Math.random() * 30;
      const centerY = 120 + row * 140 + Math.random() * 30;
      const width = 70 + Math.random() * 30;
      const height = 60 + Math.random() * 25;
      
      const points = [];
      const numPoints = 6 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const variation = 0.7 + Math.random() * 0.6;
        const x = centerX + Math.cos(angle) * width * variation;
        const y = centerY + Math.sin(angle) * height * variation;
        points.push([x, y]);
      }
      
      return points;
    }
    
    renderParcels() {
      this.parcelsGroup.innerHTML = '';
      
      this.parcels.forEach(parcel => {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const points = parcel.coordinates.map(([x, y]) => `${x},${y}`).join(' ');
        
        polygon.setAttribute('points', points);
        polygon.setAttribute('data-parcel-id', parcel.id);
        polygon.setAttribute('tabindex', parcel.eligible ? '0' : '-1');
        polygon.setAttribute('role', 'button');
        
        this.updateParcelAppearance(polygon, parcel);
        
        if (parcel.eligible) {
          polygon.style.cursor = 'pointer';
        }
        
        this.parcelsGroup.appendChild(polygon);
        
        // Add label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const centerX = parcel.coordinates.reduce((sum, [x]) => sum + x, 0) / parcel.coordinates.length;
        const centerY = parcel.coordinates.reduce((sum, [, y]) => sum + y, 0) / parcel.coordinates.length;
        
        label.setAttribute('x', centerX);
        label.setAttribute('y', centerY);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('class', 'sfi-mapping-component__parcel-label');
        label.textContent = parcel.id;
        label.style.pointerEvents = 'none';
        
        this.parcelsGroup.appendChild(label);
      });
    }
    
    updateParcelAppearance(polygonElement, parcel) {
      const parcelId = parcel.id;
      const hasActions = this.parcelActions.has(parcelId) && this.parcelActions.get(parcelId).length > 0;
      const isSelected = this.selectedParcels.has(parcelId);
      
      // Remove all state classes
      polygonElement.className.baseVal = 'sfi-mapping-component__parcel';
      
      if (!parcel.eligible) {
        polygonElement.classList.add('sfi-mapping-component__parcel--ineligible');
        polygonElement.setAttribute('aria-label', `${parcel.name}, ${parcel.size} hectares, ${parcel.landUse}, not eligible for SFI actions`);
      } else {
        polygonElement.classList.add('sfi-mapping-component__parcel--eligible');
        
        if (isSelected) {
          polygonElement.classList.add('sfi-mapping-component__parcel--selected');
          polygonElement.setAttribute('aria-pressed', 'true');
        } else {
          polygonElement.setAttribute('aria-pressed', 'false');
        }
        
        if (hasActions) {
          polygonElement.classList.add('sfi-mapping-component__parcel--has-actions');
          const actions = this.parcelActions.get(parcelId);
          const actionNames = actions.map(a => a.name).join(', ');
          polygonElement.setAttribute('aria-label', `${parcel.name}, ${parcel.size} hectares, ${parcel.landUse}, has actions: ${actionNames}`);
        } else {
          polygonElement.setAttribute('aria-label', `${parcel.name}, ${parcel.size} hectares, ${parcel.landUse}, no actions assigned`);
        }
      }
    }
    
    bindEvents() {
      // Zoom controls
      this.zoomInBtn.addEventListener('click', () => this.zoomIn());
      this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
      this.resetBtn.addEventListener('click', () => this.resetView());
      
      // Edit mode toggle
      this.editToggleBtn.addEventListener('click', () => this.toggleEditMode());
      
      // Parcel selection
      this.parcelsGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('sfi-mapping-component__parcel--eligible')) {
          this.toggleParcelSelection(e.target.dataset.parcelId);
        }
      });
      
      // Keyboard navigation
      this.mapElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
      
      // Search
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      
      // Clear selection
      this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
      
      // Map dragging
      this.mapElement.addEventListener('mousedown', (e) => this.startDrag(e));
      this.mapElement.addEventListener('mousemove', (e) => this.handleDrag(e));
      this.mapElement.addEventListener('mouseup', () => this.endDrag());
      this.mapElement.addEventListener('mouseleave', () => this.endDrag());
      
      // Hover effects
      this.parcelsGroup.addEventListener('mouseover', (e) => this.showParcelInfo(e));
      this.parcelsGroup.addEventListener('mouseout', () => this.hideParcelInfo());
    }
    
    toggleParcelSelection(parcelId) {
      const parcel = this.parcels.find(p => p.id === parcelId);
      if (!parcel || !parcel.eligible) return;
      
      if (this.selectedParcels.has(parcelId)) {
        this.selectedParcels.delete(parcelId);
      } else {
        this.selectedParcels.add(parcelId);
      }
      
      this.updateParcelAppearance(
        this.container.querySelector(`[data-parcel-id="${parcelId}"]`),
        parcel
      );
      
      this.updateSelectionInfo();
      this.updateActionPanel();
      this.updatePaymentCalculator();
      
      // Announce to screen readers
      const announcement = this.selectedParcels.has(parcelId) ? 
        `${parcel.name} selected` : `${parcel.name} deselected`;
      this.announceToScreenReader(announcement);
    }
    
    updateSelectionInfo() {
      this.selectedCount.textContent = this.selectedParcels.size;
      
      if (this.selectedParcels.size === 0) {
        this.selectedList.innerHTML = '<p class="govuk-hint">No parcels selected</p>';
        this.selectionActions.style.display = 'none';
        return;
      }
      
      this.selectionActions.style.display = 'block';
      
      const selectedParcelsData = Array.from(this.selectedParcels).map(id => 
        this.parcels.find(p => p.id === id)
      );
      
      this.selectedList.innerHTML = `
        <ul class="govuk-list">
          ${selectedParcelsData.map(parcel => {
            const actions = this.parcelActions.get(parcel.id) || [];
            return `
              <li class="sfi-mapping-component__selected-item">
                <div class="sfi-mapping-component__selected-item-content">
                  <strong>${parcel.name}</strong><br>
                  <span class="govuk-hint">${parcel.id} • ${parcel.size} ha • ${parcel.landUse}</span>
                  ${actions.length > 0 ? `<div class="sfi-mapping-component__parcel-actions">
                    ${actions.map(action => 
                      `<span class="govuk-tag govuk-tag--grey">${action.code}</span>`
                    ).join(' ')}
                  </div>` : ''}
                </div>
                <button class="govuk-button govuk-button--secondary govuk-button--small sfi-mapping-component__remove-parcel" 
                        type="button" 
                        data-parcel-id="${parcel.id}"
                        aria-label="Remove ${parcel.name} from selection">
                  Remove
                </button>
              </li>
            `;
          }).join('')}
        </ul>
      `;
      
      // Bind remove buttons
      this.selectedList.querySelectorAll('.sfi-mapping-component__remove-parcel').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.toggleParcelSelection(e.target.dataset.parcelId);
        });
      });
    }
    
    updateActionPanel() {
      if (this.selectedParcels.size === 0) {
        this.actionContent.innerHTML = '<p class="govuk-hint">Select parcels to assign actions</p>';
        return;
      }
      
      const selectedParcelsData = Array.from(this.selectedParcels).map(id => 
        this.parcels.find(p => p.id === id)
      );
      
      // Find actions compatible with all selected parcels
      const compatibleActions = this.sfiActions.filter(action => {
        return selectedParcelsData.every(parcel => {
          return action.eligibleLandUse.includes(parcel.landUse) &&
                 parseFloat(parcel.size) >= action.minArea &&
                 (action.maxArea === null || parseFloat(parcel.size) <= action.maxArea);
        });
      });
      
      this.actionContent.innerHTML = `
        <div class="sfi-mapping-component__action-list">
          ${compatibleActions.length === 0 ? 
            '<p class="govuk-body">No SFI actions are compatible with all selected parcels.</p>' :
            `<div class="govuk-form-group">
              <fieldset class="govuk-fieldset">
                <legend class="govuk-fieldset__legend govuk-fieldset__legend--s">
                  Available SFI actions for selected parcels
                </legend>
                <div class="govuk-checkboxes govuk-checkboxes--small">
                  ${compatibleActions.map(action => `
                    <div class="govuk-checkboxes__item">
                      <input class="govuk-checkboxes__input sfi-action-checkbox" 
                             id="action-${action.id}" 
                             name="actions" 
                             type="checkbox" 
                             value="${action.id}"
                             data-action-id="${action.id}">
                      <label class="govuk-label govuk-checkboxes__label" for="action-${action.id}">
                        <strong>${action.code}</strong> - ${action.name}
                        <span class="govuk-hint">£${action.payment} ${action.unit}</span>
                      </label>
                    </div>
                  `).join('')}
                </div>
              </fieldset>
            </div>
            <button class="govuk-button sfi-mapping-component__assign-actions" type="button">
              Assign selected actions
            </button>
            <button class="govuk-button govuk-button--warning sfi-mapping-component__remove-actions" type="button">
              Remove all actions from selected parcels
            </button>`
          }
        </div>
      `;
      
      // Bind action assignment buttons
      const assignBtn = this.actionContent.querySelector('.sfi-mapping-component__assign-actions');
      const removeBtn = this.actionContent.querySelector('.sfi-mapping-component__remove-actions');
      
      if (assignBtn) {
        assignBtn.addEventListener('click', () => this.assignActionsToSelected());
      }
      
      if (removeBtn) {
        removeBtn.addEventListener('click', () => this.removeActionsFromSelected());
      }
    }
    
    assignActionsToSelected() {
      const checkedActions = Array.from(this.actionContent.querySelectorAll('.sfi-action-checkbox:checked'))
        .map(checkbox => this.sfiActions.find(action => action.id === checkbox.dataset.actionId));
      
      if (checkedActions.length === 0) {
        this.announceToScreenReader('No actions selected');
        return;
      }
      
      Array.from(this.selectedParcels).forEach(parcelId => {
        if (!this.parcelActions.has(parcelId)) {
          this.parcelActions.set(parcelId, []);
        }
        
        const currentActions = this.parcelActions.get(parcelId);
        
        checkedActions.forEach(action => {
          if (!currentActions.find(a => a.id === action.id)) {
            currentActions.push(action);
          }
        });
      });
      
      this.updateParcelsDisplay();
      this.updateSelectionInfo();
      this.updatePaymentCalculator();
      
      this.announceToScreenReader(`${checkedActions.length} action(s) assigned to ${this.selectedParcels.size} parcel(s)`);
    }
    
    removeActionsFromSelected() {
      Array.from(this.selectedParcels).forEach(parcelId => {
        this.parcelActions.delete(parcelId);
      });
      
      this.updateParcelsDisplay();
      this.updateSelectionInfo();
      this.updatePaymentCalculator();
      
      this.announceToScreenReader(`Actions removed from ${this.selectedParcels.size} parcel(s)`);
    }
    
    updateParcelsDisplay() {
      this.parcels.forEach(parcel => {
        const polygonElement = this.container.querySelector(`[data-parcel-id="${parcel.id}"]`);
        if (polygonElement) {
          this.updateParcelAppearance(polygonElement, parcel);
        }
      });
    }
    
    updatePaymentCalculator() {
      let totalPayment = 0;
      let totalAreaWithActions = 0;
      
      this.parcelActions.forEach((actions, parcelId) => {
        const parcel = this.parcels.find(p => p.id === parcelId);
        if (parcel && actions.length > 0) {
          const parcelSize = parseFloat(parcel.size);
          totalAreaWithActions += parcelSize;
          
          actions.forEach(action => {
            totalPayment += action.payment * parcelSize;
          });
        }
      });
      
      this.totalPayment.textContent = `£${totalPayment.toLocaleString()}`;
      this.totalArea.textContent = `${totalAreaWithActions.toFixed(1)} hectares`;
    }
    
    toggleEditMode() {
      this.editMode = !this.editMode;
      
      if (this.editMode) {
        this.editToggleBtn.textContent = 'Disable edit mode';
        this.editToggleBtn.classList.remove('govuk-button--secondary');
        this.editToggleBtn.classList.add('govuk-button--warning');
        this.container.classList.add('sfi-mapping-component--edit-mode');
      } else {
        this.editToggleBtn.textContent = 'Enable edit mode';
        this.editToggleBtn.classList.remove('govuk-button--warning');
        this.editToggleBtn.classList.add('govuk-button--secondary');
        this.container.classList.remove('sfi-mapping-component--edit-mode');
      }
      
      this.announceToScreenReader(`Edit mode ${this.editMode ? 'enabled' : 'disabled'}`);
    }
    
    clearSelection() {
      this.selectedParcels.clear();
      this.updateParcelsDisplay();
      this.updateSelectionInfo();
      this.updateActionPanel();
      this.announceToScreenReader('Selection cleared');
    }
    
    handleSearch(query) {
      const searchTerm = query.toLowerCase().trim();
      
      this.container.querySelectorAll('.sfi-mapping-component__parcel').forEach(parcelEl => {
        const parcelId = parcelEl.dataset.parcelId;
        const parcel = this.parcels.find(p => p.id === parcelId);
        
        if (!searchTerm || 
            parcel.id.toLowerCase().includes(searchTerm) || 
            parcel.name.toLowerCase().includes(searchTerm)) {
          parcelEl.style.opacity = '1';
          parcelEl.style.filter = 'none';
        } else {
          parcelEl.style.opacity = '0.3';
          parcelEl.style.filter = 'grayscale(100%)';
        }
      });
    }
    
    // Zoom and navigation methods (similar to previous component)
    zoomIn() {
      if (this.currentZoom < this.options.maxZoom) {
        this.currentZoom *= 1.25;
        this.updateZoom();
      }
    }
    
    zoomOut() {
      if (this.currentZoom > this.options.minZoom) {
        this.currentZoom /= 1.25;
        this.updateZoom();
      }
    }
    
    resetView() {
      this.currentZoom = this.options.zoom;
      this.mapOffset = { x: 0, y: 0 };
      this.updateZoom();
    }
    
    updateZoom() {
      const transform = `scale(${this.currentZoom}) translate(${this.mapOffset.x}px, ${this.mapOffset.y}px)`;
      this.svgElement.style.transform = transform;
      
      this.zoomInBtn.disabled = this.currentZoom >= this.options.maxZoom;
      this.zoomOutBtn.disabled = this.currentZoom <= this.options.minZoom;
    }
    
    startDrag(e) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.mapElement.style.cursor = 'grabbing';
    }
    
    handleDrag(e) {
      if (!this.isDragging) return;
      
      const deltaX = e.clientX - this.dragStart.x;
      const deltaY = e.clientY - this.dragStart.y;
      
      this.mapOffset.x += deltaX / this.currentZoom;
      this.mapOffset.y += deltaY / this.currentZoom;
      
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.updateZoom();
    }
    
    endDrag() {
      this.isDragging = false;
      this.mapElement.style.cursor = 'grab';
    }
    
    handleKeyDown(e) {
      const focusedElement = document.activeElement;
      
      if (focusedElement && focusedElement.classList.contains('sfi-mapping-component__parcel--eligible')) {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            this.toggleParcelSelection(focusedElement.dataset.parcelId);
            break;
          case 'ArrowUp':
          case 'ArrowDown':
          case 'ArrowLeft':
          case 'ArrowRight':
            e.preventDefault();
            this.navigateToNextParcel(focusedElement, e.key);
            break;
        }
      }
    }
    
    navigateToNextParcel(currentElement, direction) {
      const eligibleParcels = Array.from(this.container.querySelectorAll('.sfi-mapping-component__parcel--eligible'));
      const currentIndex = eligibleParcels.indexOf(currentElement);
      
      let nextIndex;
      switch (direction) {
        case 'ArrowUp':
        case 'ArrowLeft':
          nextIndex = currentIndex > 0 ? currentIndex - 1 : eligibleParcels.length - 1;
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          nextIndex = currentIndex < eligibleParcels.length - 1 ? currentIndex + 1 : 0;
          break;
      }
      
      if (eligibleParcels[nextIndex]) {
        eligibleParcels[nextIndex].focus();
      }
    }
    
    showParcelInfo(e) {
      if (!e.target.classList.contains('sfi-mapping-component__parcel')) return;
      
      const parcelId = e.target.dataset.parcelId;
      const parcel = this.parcels.find(p => p.id === parcelId);
      if (!parcel) return;
      
      const infoPanel = this.container.querySelector('.sfi-mapping-component__parcel-info');
      const title = this.container.querySelector('#sfi-info-title');
      const size = this.container.querySelector('#sfi-info-size');
      const landuse = this.container.querySelector('#sfi-info-landuse');
      const actions = this.container.querySelector('#sfi-info-actions');
      
      title.textContent = parcel.name;
      size.textContent = `${parcel.size} hectares`;
      landuse.textContent = parcel.landUse;
      
      const parcelActions = this.parcelActions.get(parcelId) || [];
      if (parcelActions.length > 0) {
        actions.innerHTML = parcelActions.map(action => 
          `<span class="govuk-tag govuk-tag--grey">${action.code}</span>`
        ).join(' ');
      } else {
        actions.textContent = 'None assigned';
      }
      
      infoPanel.style.display = 'block';
    }
    
    hideParcelInfo() {
      const infoPanel = this.container.querySelector('.sfi-mapping-component__parcel-info');
      infoPanel.style.display = 'none';
    }
    
    announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'govuk-visually-hidden';
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
    
    // Public API methods
    getSelectedParcels() {
      return Array.from(this.selectedParcels);
    }
    
    getParcelActions() {
      const result = {};
      this.parcelActions.forEach((actions, parcelId) => {
        result[parcelId] = actions.map(action => ({
          id: action.id,
          code: action.code,
          name: action.name,
          payment: action.payment
        }));
      });
      return result;
    }
    
    getTotalPayment() {
      let total = 0;
      this.parcelActions.forEach((actions, parcelId) => {
        const parcel = this.parcels.find(p => p.id === parcelId);
        if (parcel) {
          const parcelSize = parseFloat(parcel.size);
          actions.forEach(action => {
            total += action.payment * parcelSize;
          });
        }
      });
      return total;
    }
    
    exportData() {
      return {
        selectedParcels: this.getSelectedParcels(),
        parcelActions: this.getParcelActions(),
        totalPayment: this.getTotalPayment(),
        parcels: this.parcels.map(p => ({
          id: p.id,
          name: p.name,
          size: p.size,
          landUse: p.landUse
        }))
      };
    }
  }
  
  // Make the class globally available
  window.SFIMappingComponent = SFIMappingComponent;
  
  // Auto-initialize SFI mapping components
  document.querySelectorAll('[data-sfi-mapping-component]').forEach(element => {
    const options = element.dataset.sfiMappingOptions ? 
      JSON.parse(element.dataset.sfiMappingOptions) : {};
    new SFIMappingComponent(element, options);
  });
  
});
