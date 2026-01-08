# fcp-future-rps

## Overview
This is a GOV.UK Prototype Kit application for prototyping the Future Rural Payments Scheme (RPS). The app uses Nunjucks templates for views, with multiple prototype iterations stored in versioned subdirectories under `app/views/` (e.g., `v1/`, `v2-apply/`, `day1-locked/`).

Key components:
- `app/routes.js`: Defines routes, custom Nunjucks filters (e.g., `formatCurrency` for currency formatting), and mock data (e.g., `getMockRPAData()` for land parcel data).
- `app/views/`: Nunjucks templates using GOV.UK design system classes.
- `app/assets/`: JavaScript, Sass, and images.
- Python scripts (e.g., `update_links.py`): For bulk updating HTML templates with regex replacements.

## Developer Workflows
- **Development**: Run `npm run dev` to start the development server with hot reloading.
- **Serving**: Use `npm run serve` for production-like serving.
- **Maintenance**: Execute Python scripts like `python3 update_links.py` to update links across templates.

## Conventions and Patterns
- **Template Structure**: Extend `layouts/main.html`, use GOV.UK classes (e.g., `govuk-heading-xl`, `govuk-table`).
- **Data Handling**: Mock data in `routes.js`; session data in `app/data/session-data-defaults.js` (currently empty).
- **Mapping Integration**: Use `@defra/defra-map` for interactive maps; see `app/assets/javascripts/sfi-mapping-component.js` for examples.
- **Versioning**: New prototype versions in separate subdirs; reference key files like `app/views/day1-locked/index.html` for current stable version.

## Integration Points
- External dependencies: `notifications-node-client` for email notifications, `node-fetch` for HTTP requests.
- Custom filters: Add to `routes.js` using `govukPrototypeKit.views.addFilter()`.</content>
<parameter name="filePath">/Users/richardpayne/Documents/GitHub/fcp-future-rps/.github/copilot-instructions.md
