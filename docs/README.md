# Документация myUNO — единый каталог

Обновлено по коду main **16 октября 2026**. Старый numbered suite больше не выдается за полный shipped status. Документы разделены по назначению; исходники и evidence на конкретном SHA определяют факт.

## Актуальное руководство

| Документ | Что содержит |
|---|---|
| [README](../README.md) | Вход в репозиторий, стек, процессы, запуск и важные ограничения |
| [SYSTEM](current/SYSTEM.md) | Все модули, связи, роли, данные, money и интеграции |
| [PROCESS_COVERAGE](current/PROCESS_COVERAGE.md) | Все 30 целевых бизнес-процессов и функции, у которых ещё нет runtime-модуля |
| [IMPLEMENTATION_STATUS](current/IMPLEMENTATION_STATUS.md) | Что реализовано, что осталось, confirmed gaps, runtime unknowns, open PRs |
| [REFERENCE](current/REFERENCE.md) | Все pages/handlers/methods, module files/exports, модели/поля/enums, migrations/tests/env consumers |
| [OPERATIONS](current/OPERATIONS.md) | Vercel-only deploy, БД, секреты, CI, scheduler, backup/recovery |
| [SOP](SOPs/README.md) | Короткие рабочие инструкции команды, соответствующие коду |
| [DOCS_POLICY](current/DOCS_POLICY.md) | Иерархия фактов и обновление документов с каждым изменением |
| [CONTRIBUTING](../CONTRIBUTING.md) / [SECURITY](../SECURITY.md) | Разработка, проверки, доступ и защита данных |

## Целевая архитектура

[PROJECT](../PROJECT.md) и [canonical](canonical/README.md) сохраняют продуктовые требования. Их нельзя считать перечнем завершённых функций. Сверка target↔main — [RECONCILIATION](canonical/RECONCILIATION.md) и текущая матрица.

## Полный каталог Markdown-документов

`current` — актуальный вход или guide; `target` — требования; `reference` — дополнительные спецификации/материалы; `historical` — датированный отчёт прежнего среза. Historical/reference материалы не подтверждают актуальную production готовность. Прежние версии изменённых документов доступны в Git history.

| Документ | Тип |
|---|---|
| [current/PROCESS_COVERAGE.md](current/PROCESS_COVERAGE.md) | current |
| [current/AUDIT_EVIDENCE.md](current/AUDIT_EVIDENCE.md) | current |
| [00_legacy_audit.md](<00_legacy_audit.md>) | current |
| [01_architecture_decisions.md](<01_architecture_decisions.md>) | current |
| [02_data_model.md](<02_data_model.md>) | current |
| [03_roles_and_permissions.md](<03_roles_and_permissions.md>) | current |
| [04_configuration.md](<04_configuration.md>) | current |
| [05_content_i18n.md](<05_content_i18n.md>) | current |
| [06_design_system.md](<06_design_system.md>) | current |
| [07_flows.md](<07_flows.md>) | current |
| [08_pages.md](<08_pages.md>) | current |
| [09_communication_and_services.md](<09_communication_and_services.md>) | current |
| [10_payments.md](<10_payments.md>) | current |
| [11_notifications.md](<11_notifications.md>) | current |
| [12_security_privacy.md](<12_security_privacy.md>) | current |
| [13_analytics.md](<13_analytics.md>) | current |
| [14_tech_spec.md](<14_tech_spec.md>) | current |
| [15_deployment.md](<15_deployment.md>) | current |
| [16_build_plan.md](<16_build_plan.md>) | current |
| [17_crm_and_commercial_system.md](<17_crm_and_commercial_system.md>) | current |
| [18_platform_architecture.md](<18_platform_architecture.md>) | current |
| [ANALYTICS_FUNNEL_MAPPING.md](<ANALYTICS_FUNNEL_MAPPING.md>) | reference |
| [DATABASE_SETUP.md](<DATABASE_SETUP.md>) | current |
| [P1-execution-plan.md](<P1-execution-plan.md>) | historical |
| [PRD_MYUNO_ONE_STOP_SHOP.md](<PRD_MYUNO_ONE_STOP_SHOP.md>) | reference |
| [README.md](<README.md>) | current |
| [SOPs/01_guest_booking_checkin.md](<SOPs/01_guest_booking_checkin.md>) | current |
| [SOPs/02_host_property_management.md](<SOPs/02_host_property_management.md>) | current |
| [SOPs/03_payments_financial.md](<SOPs/03_payments_financial.md>) | current |
| [SOPs/04_crm_lead_management.md](<SOPs/04_crm_lead_management.md>) | current |
| [SOPs/05_service_ordering.md](<SOPs/05_service_ordering.md>) | current |
| [SOPs/06_production_cutover.md](<SOPs/06_production_cutover.md>) | current |
| [SOPs/README.md](<SOPs/README.md>) | current |
| [STITCH_FLOW_RECONCILIATION.md](<STITCH_FLOW_RECONCILIATION.md>) | historical |
| [T-042_hardening_checklist.md](<T-042_hardening_checklist.md>) | historical |
| [T-043-READINESS.md](<T-043-READINESS.md>) | historical |
| [VERCEL-SETUP.md](<VERCEL-SETUP.md>) | current |
| [WORKSPACE_NAVIGATION_INCREMENT_2026-10-15.md](<WORKSPACE_NAVIGATION_INCREMENT_2026-10-15.md>) | historical |
| [architecture/AIRBNB_PARITY.md](<architecture/AIRBNB_PARITY.md>) | reference |
| [architecture/ATTRIBUTE_OWNERSHIP_MATRIX.md](<architecture/ATTRIBUTE_OWNERSHIP_MATRIX.md>) | reference |
| [architecture/CANONICAL_PROPERTY_DATA_ARCHITECTURE.md](<architecture/CANONICAL_PROPERTY_DATA_ARCHITECTURE.md>) | reference |
| [architecture/CANONICAL_RATE_PLAN_MIGRATION.md](<architecture/CANONICAL_RATE_PLAN_MIGRATION.md>) | reference |
| [architecture/CANONICAL_RENT_OUT_MANAGE_ONBOARDING.md](<architecture/CANONICAL_RENT_OUT_MANAGE_ONBOARDING.md>) | reference |
| [architecture/CANONICAL_STAY_DOMAIN_CONTRACT.md](<architecture/CANONICAL_STAY_DOMAIN_CONTRACT.md>) | reference |
| [architecture/CANONICAL_STAY_UX_CONTRACT.md](<architecture/CANONICAL_STAY_UX_CONTRACT.md>) | reference |
| [architecture/EMPLOYEE_CREATION_REVIEW.md](<architecture/EMPLOYEE_CREATION_REVIEW.md>) | reference |
| [architecture/ERD_CORE_DOMAIN.md](<architecture/ERD_CORE_DOMAIN.md>) | reference |
| [architecture/EXECUTIVE_SUMMARY.md](<architecture/EXECUTIVE_SUMMARY.md>) | reference |
| [architecture/FLOW_REACHABILITY_AUDIT.md](<architecture/FLOW_REACHABILITY_AUDIT.md>) | historical |
| [architecture/LAYANTARA_RELEASE_AND_ROLLBACK.md](<architecture/LAYANTARA_RELEASE_AND_ROLLBACK.md>) | reference |
| [architecture/LAYANTARA_UNIFICATION_IMPLEMENTATION.md](<architecture/LAYANTARA_UNIFICATION_IMPLEMENTATION.md>) | reference |
| [architecture/MANAGED_PORTFOLIO_OS.md](<architecture/MANAGED_PORTFOLIO_OS.md>) | reference |
| [architecture/ONBOARDING_FLOW_AUDIT.md](<architecture/ONBOARDING_FLOW_AUDIT.md>) | historical |
| [architecture/PHASE0_EVIDENCE_REPORT.md](<architecture/PHASE0_EVIDENCE_REPORT.md>) | reference |
| [architecture/PHASE1_IMPLEMENTATION_PLAN.md](<architecture/PHASE1_IMPLEMENTATION_PLAN.md>) | reference |
| [architecture/PLATFORM_MATURITY.md](<architecture/PLATFORM_MATURITY.md>) | reference |
| [architecture/PRODUCTION_READINESS.md](<architecture/PRODUCTION_READINESS.md>) | historical |
| [architecture/PROJECT_SPACE_SERVICES_JOURNEYS_ACCESS.md](<architecture/PROJECT_SPACE_SERVICES_JOURNEYS_ACCESS.md>) | reference |
| [architecture/PROPERTY_ONBOARDING_UX_PARITY.md](<architecture/PROPERTY_ONBOARDING_UX_PARITY.md>) | reference |
| [architecture/REVENUE_AND_TARIFF_ENGINE.md](<architecture/REVENUE_AND_TARIFF_ENGINE.md>) | reference |
| [architecture/guest_journey_architecture.md](<architecture/guest_journey_architecture.md>) | reference |
| [architecture-destination-audit.md](<architecture-destination-audit.md>) | historical |
| [architecture-funnel-audit.md](<architecture-funnel-audit.md>) | historical |
| [architecture-infrastructure-audit.md](<architecture-infrastructure-audit.md>) | historical |
| [architecture-operations-audit.md](<architecture-operations-audit.md>) | historical |
| [architecture-platform-audit.md](<architecture-platform-audit.md>) | historical |
| [architecture-security-platform-audit.md](<architecture-security-platform-audit.md>) | historical |
| [audit/canonical-models-projects-units-2026-09-07.md](<audit/canonical-models-projects-units-2026-09-07.md>) | historical |
| [audit/full-audit-2026-07-17.md](<audit/full-audit-2026-07-17.md>) | historical |
| [audit/preflight-audit-2026-07-16.md](<audit/preflight-audit-2026-07-16.md>) | historical |
| [audit/property-flows-2026-09-07.md](<audit/property-flows-2026-09-07.md>) | historical |
| [audits/AIRBNB_GUEST_FLOW_GAP_ANALYSIS.md](<audits/AIRBNB_GUEST_FLOW_GAP_ANALYSIS.md>) | historical |
| [audits/AI_AUDIT_REPORT_TEMPLATE.md](<audits/AI_AUDIT_REPORT_TEMPLATE.md>) | historical |
| [audits/AI_E2E_CODE_AUDIT_2026-10-11.md](<audits/AI_E2E_CODE_AUDIT_2026-10-11.md>) | historical |
| [audits/AI_FLOW_SURFACE_MATRIX.md](<audits/AI_FLOW_SURFACE_MATRIX.md>) | historical |
| [audits/AI_FULL_PLATFORM_AUDIT.md](<audits/AI_FULL_PLATFORM_AUDIT.md>) | historical |
| [audits/AI_MAIN_AUDIT_2026-10-11.md](<audits/AI_MAIN_AUDIT_2026-10-11.md>) | historical |
| [audits/CANONICAL_OPERATING_LOOP_EXECUTION_2026-10-08.md](<audits/CANONICAL_OPERATING_LOOP_EXECUTION_2026-10-08.md>) | historical |
| [audits/CANONICAL_PROCESS_MATURITY_AUDIT_2026-10-08.md](<audits/CANONICAL_PROCESS_MATURITY_AUDIT_2026-10-08.md>) | historical |
| [audits/CANONICAL_PROPERTY_DATA_AUDIT.md](<audits/CANONICAL_PROPERTY_DATA_AUDIT.md>) | historical |
| [audits/CARD_CHECKOUT_HTTP_2026-10-09.md](<audits/CARD_CHECKOUT_HTTP_2026-10-09.md>) | historical |
| [audits/CARD_CHECKOUT_POLICY_2026-10-09.md](<audits/CARD_CHECKOUT_POLICY_2026-10-09.md>) | historical |
| [audits/CONSOLIDATED_CHAIN_PREFLIGHT_2026-09-29.md](<audits/CONSOLIDATED_CHAIN_PREFLIGHT_2026-09-29.md>) | historical |
| [audits/DESIGN_SYSTEM_GAP_CLOSURE_2026-10-01.md](<audits/DESIGN_SYSTEM_GAP_CLOSURE_2026-10-01.md>) | historical |
| [audits/DEVELOPER_DATA_MODEL_AUDIT.md](<audits/DEVELOPER_DATA_MODEL_AUDIT.md>) | historical |
| [audits/GUEST_JOURNEY_IMPLEMENTATION_REPORT.md](<audits/GUEST_JOURNEY_IMPLEMENTATION_REPORT.md>) | historical |
| [audits/HOMEPAGE_VISUAL_REVIEW_2026-10-02.md](<audits/HOMEPAGE_VISUAL_REVIEW_2026-10-02.md>) | historical |
| [audits/INVENTORY_AND_RATE_SCOPE_AUDIT.md](<audits/INVENTORY_AND_RATE_SCOPE_AUDIT.md>) | historical |
| [audits/LAYANTARA_CUTOVER_PREFLIGHT_LIVE_2026-09-29.md](<audits/LAYANTARA_CUTOVER_PREFLIGHT_LIVE_2026-09-29.md>) | historical |
| [audits/LAYANTARA_LIVE_PREFLIGHT_2026-09-30.md](<audits/LAYANTARA_LIVE_PREFLIGHT_2026-09-30.md>) | historical |
| [audits/LAYANTARA_LIVE_RECONCILIATION_2026-09-29.md](<audits/LAYANTARA_LIVE_RECONCILIATION_2026-09-29.md>) | historical |
| [audits/LAYANTARA_PROJECT_PORTAL_PARITY_2026-09-30.md](<audits/LAYANTARA_PROJECT_PORTAL_PARITY_2026-09-30.md>) | historical |
| [audits/LAYANTARA_RELEASE_EXECUTION_STATUS_2026-09-29.md](<audits/LAYANTARA_RELEASE_EXECUTION_STATUS_2026-09-29.md>) | historical |
| [audits/LAYANTARA_TO_MYUNO_SINGLE_BACKBONE_RUNBOOK_2026-09-29.md](<audits/LAYANTARA_TO_MYUNO_SINGLE_BACKBONE_RUNBOOK_2026-09-29.md>) | historical |
| [audits/MEDIA_READINESS_PROJECT_PORTALS_2026-10-04.md](<audits/MEDIA_READINESS_PROJECT_PORTALS_2026-10-04.md>) | historical |
| [audits/NIGHT_BOOKING_INTEGRITY_2026-10-08.md](<audits/NIGHT_BOOKING_INTEGRITY_2026-10-08.md>) | historical |
| [audits/NIGHT_FLOW_COVERAGE_2026-10-08.md](<audits/NIGHT_FLOW_COVERAGE_2026-10-08.md>) | historical |
| [audits/ONE_OPERATIONAL_REALITY_RELEASE.md](<audits/ONE_OPERATIONAL_REALITY_RELEASE.md>) | historical |
| [audits/P0_P1_PRODUCT_CONSOLIDATION_2026-10-03.md](<audits/P0_P1_PRODUCT_CONSOLIDATION_2026-10-03.md>) | historical |
| [audits/PR167_REPAIR_2026-10-02.md](<audits/PR167_REPAIR_2026-10-02.md>) | historical |
| [audits/PROCESS_MAP_IMPLEMENTATION_AUDIT_2026-09-28.md](<audits/PROCESS_MAP_IMPLEMENTATION_AUDIT_2026-09-28.md>) | historical |
| [audits/PRODUCTION_DEPLOYMENT_RETRY_2026-10-01.md](<audits/PRODUCTION_DEPLOYMENT_RETRY_2026-10-01.md>) | historical |
| [audits/PROPERTY_DATA_CHANNEL_PARITY.md](<audits/PROPERTY_DATA_CHANNEL_PARITY.md>) | historical |
| [audits/PROPERTY_DATA_IMPLEMENTATION_VALIDATION.md](<audits/PROPERTY_DATA_IMPLEMENTATION_VALIDATION.md>) | historical |
| [audits/REVENUE_ENGINE_CONSOLIDATION_2026-09-29.md](<audits/REVENUE_ENGINE_CONSOLIDATION_2026-09-29.md>) | historical |
| [audits/ROLE_DASHBOARDS_2026-09-29.md](<audits/ROLE_DASHBOARDS_2026-09-29.md>) | historical |
| [audits/STATIC_RESOURCE_GALLERY_ONBOARDING_2026-09-29.md](<audits/STATIC_RESOURCE_GALLERY_ONBOARDING_2026-09-29.md>) | historical |
| [audits/STATIC_ROUTE_BASELINE_2026-09-29.md](<audits/STATIC_ROUTE_BASELINE_2026-09-29.md>) | historical |
| [audits/SUPPLIER_LISTING_JOURNEY_2026-10-02.md](<audits/SUPPLIER_LISTING_JOURNEY_2026-10-02.md>) | historical |
| [audits/TARIFF_EDITOR_USABILITY_2026-10-14.md](<audits/TARIFF_EDITOR_USABILITY_2026-10-14.md>) | historical |
| [audits/THAILAND_PROPERTY_COMPLIANCE_MODEL.md](<audits/THAILAND_PROPERTY_COMPLIANCE_MODEL.md>) | historical |
| [audits/UNIFIED_JOURNEY_EXECUTION_2026-09-29.md](<audits/UNIFIED_JOURNEY_EXECUTION_2026-09-29.md>) | historical |
| [audits/UX_SYSTEM_IMPLEMENTATION_2026-10-02.md](<audits/UX_SYSTEM_IMPLEMENTATION_2026-10-02.md>) | historical |
| [audits/architecture-2026-10-08/BASELINE.md](<audits/architecture-2026-10-08/BASELINE.md>) | historical |
| [audits/architecture-2026-10-08/DATA_RECONCILIATION.md](<audits/architecture-2026-10-08/DATA_RECONCILIATION.md>) | historical |
| [audits/architecture-2026-10-08/FLOW_MATRIX.md](<audits/architecture-2026-10-08/FLOW_MATRIX.md>) | historical |
| [audits/architecture-2026-10-08/GAPS.md](<audits/architecture-2026-10-08/GAPS.md>) | historical |
| [audits/architecture-2026-10-08/RELEASE_EVIDENCE.md](<audits/architecture-2026-10-08/RELEASE_EVIDENCE.md>) | historical |
| [audits/architecture-2026-10-08/SOURCE_OF_TRUTH.md](<audits/architecture-2026-10-08/SOURCE_OF_TRUTH.md>) | historical |
| [audits/architecture-2026-10-08/SURFACE_MAP.md](<audits/architecture-2026-10-08/SURFACE_MAP.md>) | historical |
| [audits/frontend-backend-contract-2026-09-28.md](<audits/frontend-backend-contract-2026-09-28.md>) | historical |
| [audits/gallery-copy-existing-2026-10-12.md](<audits/gallery-copy-existing-2026-10-12.md>) | historical |
| [audits/public-gallery-cover-2026-10-12.md](<audits/public-gallery-cover-2026-10-12.md>) | historical |
| [authentication-setup.md](<authentication-setup.md>) | reference |
| [brand/brand_direction.md](<brand/brand_direction.md>) | reference |
| [business/Ignatev_Estate_Business_and_Operating_Model_v3.md](<business/Ignatev_Estate_Business_and_Operating_Model_v3.md>) | reference |
| [business/brand_and_governance.md](<business/brand_and_governance.md>) | reference |
| [business/positioning.md](<business/positioning.md>) | reference |
| [business/user_journey_audit.md](<business/user_journey_audit.md>) | historical |
| [canonical/AI_AGENT_RULES.md](<canonical/AI_AGENT_RULES.md>) | target |
| [canonical/ARCHITECTURE.md](<canonical/ARCHITECTURE.md>) | target |
| [canonical/CRM_SPEC.md](<canonical/CRM_SPEC.md>) | target |
| [canonical/DATA_MODEL.md](<canonical/DATA_MODEL.md>) | target |
| [canonical/DECISIONS_CHANGELOG.md](<canonical/DECISIONS_CHANGELOG.md>) | target |
| [canonical/DESIGN.md](<canonical/DESIGN.md>) | target |
| [canonical/MIGRATION_DELIVERY.md](<canonical/MIGRATION_DELIVERY.md>) | target |
| [canonical/PROCESS_MAP.md](<canonical/PROCESS_MAP.md>) | target |
| [canonical/PROCESS_PASSPORTS.md](<canonical/PROCESS_PASSPORTS.md>) | target |
| [canonical/PRODUCT.md](<canonical/PRODUCT.md>) | target |
| [canonical/QA_ACCEPTANCE.md](<canonical/QA_ACCEPTANCE.md>) | target |
| [canonical/READINESS_ACCEPTANCE.md](<canonical/READINESS_ACCEPTANCE.md>) | target |
| [canonical/README.md](<canonical/README.md>) | target |
| [canonical/RECONCILIATION.md](<canonical/RECONCILIATION.md>) | current |
| [canonical/RELEASE_EVIDENCE_2026-09-09.md](<canonical/RELEASE_EVIDENCE_2026-09-09.md>) | target |
| [canonical/ROADMAP.md](<canonical/ROADMAP.md>) | target |
| [canonical/ROLE_WORKSPACES.md](<canonical/ROLE_WORKSPACES.md>) | target |
| [canonical/SERVICES_MARKETPLACE.md](<canonical/SERVICES_MARKETPLACE.md>) | target |
| [content-review-plan.md](<content-review-plan.md>) | reference |
| [corporate_bible_integration.md](<corporate_bible_integration.md>) | reference |
| [current/DOCS_POLICY.md](<current/DOCS_POLICY.md>) | current |
| [current/IMPLEMENTATION_STATUS.md](<current/IMPLEMENTATION_STATUS.md>) | current |
| [current/OPERATIONS.md](<current/OPERATIONS.md>) | current |
| [current/REFERENCE.md](<current/REFERENCE.md>) | current |
| [current/SYSTEM.md](<current/SYSTEM.md>) | current |
| [delivery/GUEST_JOURNEY_UX_20261015.md](<delivery/GUEST_JOURNEY_UX_20261015.md>) | historical |
| [delivery/PROD_LEDGER_ALIGNMENT_2026-10-12.md](<delivery/PROD_LEDGER_ALIGNMENT_2026-10-12.md>) | historical |
| [delivery/claude-expense-owner-report/04-external-hunk-content-seed.md](<delivery/claude-expense-owner-report/04-external-hunk-content-seed.md>) | historical |
| [delivery/claude-expense-owner-report/MANIFEST.md](<delivery/claude-expense-owner-report/MANIFEST.md>) | historical |
| [delivery/claude-expense-owner-report/REPORT.md](<delivery/claude-expense-owner-report/REPORT.md>) | historical |
| [delivery/e2e-walkthrough/01-guest-booking/RESULT.md](<delivery/e2e-walkthrough/01-guest-booking/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/02-expense-report/RESULT.md](<delivery/e2e-walkthrough/02-expense-report/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/03-owner-payout/RESULT.md](<delivery/e2e-walkthrough/03-owner-payout/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/04-auth/RESULT.md](<delivery/e2e-walkthrough/04-auth/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/05-checkin-tm30/RESULT.md](<delivery/e2e-walkthrough/05-checkin-tm30/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/06-services/RESULT.md](<delivery/e2e-walkthrough/06-services/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/07-lead-crm/RESULT.md](<delivery/e2e-walkthrough/07-lead-crm/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/08-property-publication/RESULT.md](<delivery/e2e-walkthrough/08-property-publication/RESULT.md>) | historical |
| [delivery/e2e-walkthrough/09-founder-publication-booking/README.md](<delivery/e2e-walkthrough/09-founder-publication-booking/README.md>) | historical |
| [delivery/e2e-walkthrough/README.md](<delivery/e2e-walkthrough/README.md>) | historical |
| [delivery/operating-workspace-access.md](<delivery/operating-workspace-access.md>) | historical |
| [design/stitch/INTEGRATION_MAP.md](<design/stitch/INTEGRATION_MAP.md>) | reference |
| [design/stitch/README.md](<design/stitch/README.md>) | reference |
| [design/stitch/SCHEMA_RECONCILIATION.md](<design/stitch/SCHEMA_RECONCILIATION.md>) | historical |
| [design/stitch/andaman_sanctuary_architectural_living/DESIGN.md](<design/stitch/andaman_sanctuary_architectural_living/DESIGN.md>) | reference |
| [design/stitch/myuno_homepage_strategy_ru.md](<design/stitch/myuno_homepage_strategy_ru.md>) | reference |
| [design/stitch/specs/app-router-route-specification.md](<design/stitch/specs/app-router-route-specification.md>) | reference |
| [design/stitch/specs/homepage-strategy-ru.md](<design/stitch/specs/homepage-strategy-ru.md>) | reference |
| [design/stitch/specs/readme-export-master-spec.md](<design/stitch/specs/readme-export-master-spec.md>) | reference |
| [design/stitch/specs/tailwind-theme-tokens.md](<design/stitch/specs/tailwind-theme-tokens.md>) | reference |
| [design.md](<design.md>) | reference |
| [design_system_canvas/CURSOR_PROMPT.md](<design_system_canvas/CURSOR_PROMPT.md>) | reference |
| [design_system_canvas/_ds/broadsheet-d2571619-2079-41ac-bb54-67c6772e25db/readme.md](<design_system_canvas/_ds/broadsheet-d2571619-2079-41ac-bb54-67c6772e25db/readme.md>) | reference |
| [design_system_canvas/_ds/nocturne-e80063fd-8e27-400f-bb35-2b11a763fee5/readme.md](<design_system_canvas/_ds/nocturne-e80063fd-8e27-400f-bb35-2b11a763fee5/readme.md>) | reference |
| [design_system_canvas/github.md](<design_system_canvas/github.md>) | reference |
| [discovery-navigation-audit.md](<discovery-navigation-audit.md>) | historical |
| [evidence/complex-amenities-2026-10-15.md](<evidence/complex-amenities-2026-10-15.md>) | reference |
| [evidence/direct-content-photo-upload-2026-10-15.md](<evidence/direct-content-photo-upload-2026-10-15.md>) | reference |
| [evidence/employee-creation-browser-acceptance.md](<evidence/employee-creation-browser-acceptance.md>) | reference |
| [evidence/project-amenity-content-proposals-2026-10-15.md](<evidence/project-amenity-content-proposals-2026-10-15.md>) | reference |
| [launch_checklist.md](<launch_checklist.md>) | historical |
| [migrations.md](<migrations.md>) | reference |
| [open_questions.md](<open_questions.md>) | reference |
| [operations/content-contributor-workflow.md](<operations/content-contributor-workflow.md>) | reference |
| [payment-confirmation-workflow.md](<payment-confirmation-workflow.md>) | reference |
| [phase-5-founder-review-audit.md](<phase-5-founder-review-audit.md>) | historical |
| [pms-rates-audit.md](<pms-rates-audit.md>) | historical |
| [pms-runtime-audit.md](<pms-runtime-audit.md>) | historical |
| [pms-source-audit.md](<pms-source-audit.md>) | historical |
| [product-audit-2026-10-08.md](<product-audit-2026-10-08.md>) | historical |
| [runbooks/database-recovery.md](<runbooks/database-recovery.md>) | reference |
| [stitch-coverage-audit.md](<stitch-coverage-audit.md>) | historical |
| [stitch-fidelity-audit.md](<stitch-fidelity-audit.md>) | historical |
| [stitch-public-runtime-audit.md](<stitch-public-runtime-audit.md>) | historical |
| [verification/guest-tm30-snapshot-20261012.md](<verification/guest-tm30-snapshot-20261012.md>) | reference |

Документы вне docs/: README/PROJECT/AGENTS/CLAUDE/CONTRIBUTING/SECURITY и deployment entry points находятся в корне. Каждый module README ссылается на текущую матрицу и полный reference. Design HTML/images, SQL и binary artifacts — reference/evidence; их содержание не является production instruction.

- [audits/production-pms-2026-10-16/BASELINE.md](audits/production-pms-2026-10-16/BASELINE.md) — historical evidence.
- [audits/production-pms-2026-10-16/DATA_RECONCILIATION.md](audits/production-pms-2026-10-16/DATA_RECONCILIATION.md) — historical evidence.
- [audits/production-pms-2026-10-16/FLOW_MATRIX.md](audits/production-pms-2026-10-16/FLOW_MATRIX.md) — historical evidence.
- [audits/production-pms-2026-10-16/GAPS.md](audits/production-pms-2026-10-16/GAPS.md) — historical evidence.
- [audits/production-pms-2026-10-16/RELEASE_EVIDENCE.md](audits/production-pms-2026-10-16/RELEASE_EVIDENCE.md) — historical evidence.
- [audits/production-pms-2026-10-16/SOURCE_OF_TRUTH.md](audits/production-pms-2026-10-16/SOURCE_OF_TRUTH.md) — historical evidence.
- [audits/production-pms-2026-10-16/SURFACE_MAP.md](audits/production-pms-2026-10-16/SURFACE_MAP.md) — historical evidence.
