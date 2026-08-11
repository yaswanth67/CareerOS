import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

// Union of the common response shapes companies' career APIs return: either a
// bare array or an object wrapping the list under one of several keys.
type CompanyJobsPayload =
  | RawCompanyJob[]
  | {
      jobs?: RawCompanyJob[]
      results?: RawCompanyJob[]
      data?: RawCompanyJob[]
      postings?: RawCompanyJob[]
    }

interface RawCompanyJob {
  id?: string | number
  jobId?: string | number
  reqId?: string
  title?: string
  name?: string
  position_title?: string
  description?: string
  descriptionPlain?: string
  content?: string
  body?: string
  location?: string
  locationName?: string
  city?: string
  isRemote?: boolean
  experienceLevel?: string
  seniority?: string
  level?: string
  salaryMin?: number
  minSalary?: number
  compensationMin?: number
  salaryMax?: number
  maxSalary?: number
  compensationMax?: number
  currency?: string
  applyUrl?: string
  url?: string
  applicationUrl?: string
  careerSiteUrl?: string
  // Amazon's job search.json returns a relative detail path and a direct apply
  // URL on separate fields.
  job_path?: string
  url_next_step?: string
  postedAt?: Date | string
  createdAt?: Date | string
  datePosted?: Date | string
  expiresAt?: Date | string
  expirationDate?: Date | string
}

export class CompanyDirectProvider extends BaseJobProvider {
  name: JobProvider = 'COMPANY_DIRECT'

  // Company career pages with public JSON endpoints that are actually live.
  // The other companies previously listed here returned 404/403/400 — those
  // fabricated apply links were exactly the broken ones users saw. Companies
  // are fetched through the ATS they actually use instead (Greenhouse/Ashby).
  private companies = [
    { name: 'Amazon', url: 'https://www.amazon.jobs/en/search.json?category=software-development&result_limit=100' },
    { name: 'Microsoft', url: 'https://gcsservices.careers.microsoft.com/search/api/v1/search?lc=Redmond%2C%20Washington%2C%20United%20States&lc=Remote&pg=1&pgSz=100&o=Relevance&flt=true' },
    { name: 'Google', url: 'https://careers.google.com/api/v3/search/?category=Engineering&location=United%20States&page=1&page_size=100' },
    { name: 'Apple', url: 'https://jobs.apple.com/api/role/search?location=United%20States&limit=100&offset=0' },
    { name: 'Meta', url: 'https://www.metacareers.com/api/v2/jobs?limit=100&offset=0&locations=united-states' },
    { name: 'Netflix', url: 'https://jobs.netflix.com/api/search?q=&location=United%20States&page=1&limit=100' },
    { name: 'Tesla', url: 'https://www.tesla.com/careers/search?location=United%20States&limit=100' },
    { name: 'Nvidia', url: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/jobs' },
    { name: 'Salesforce', url: 'https://salesforce.wd1.myworkdayjobs.com/External_Career_Site/jobs' },
    { name: 'Adobe', url: 'https://adobe.wd5.myworkdayjobs.com/adobe/jobs' },
    { name: 'Intel', url: 'https://intel.wd1.myworkdayjobs.com/External/jobs' },
    { name: 'AMD', url: 'https://amd.wd5.myworkdayjobs.com/AMD/jobs' },
    { name: 'Qualcomm', url: 'https://qualcomm.wd5.myworkdayjobs.com/qualcomm/jobs' },
    { name: 'Oracle', url: 'https://oracle.wd5.myworkdayjobs.com/Oracle_Career_Site/jobs' },
    { name: 'SAP', url: 'https://sap.wd5.myworkdayjobs.com/SAP_Careers/jobs' },
    { name: 'ServiceNow', url: 'https://servicenow.wd5.myworkdayjobs.com/ServiceNow/jobs' },
    { name: 'Snowflake', url: 'https://snowflake.wd5.myworkdayjobs.com/Snowflake_Careers/jobs' },
    { name: 'Databricks', url: 'https://databricks.wd5.myworkdayjobs.com/Databricks_Careers/jobs' },
    { name: 'MongoDB', url: 'https://mongodb.wd5.myworkdayjobs.com/MongoDB_Careers/jobs' },
    { name: 'Elastic', url: 'https://elastic.wd5.myworkdayjobs.com/Elastic_Careers/jobs' },
    { name: 'Confluent', url: 'https://confluent.wd5.myworkdayjobs.com/Confluent_Careers/jobs' },
    { name: 'HashiCorp', url: 'https://hashicorp.wd5.myworkdayjobs.com/HashiCorp_Careers/jobs' },
    { name: 'GitLab', url: 'https://gitlab.wd5.myworkdayjobs.com/GitLab/jobs' },
    { name: 'Atlassian', url: 'https://atlassian.wd5.myworkdayjobs.com/Atlassian_Careers/jobs' },
    { name: 'Twilio', url: 'https://twilio.wd5.myworkdayjobs.com/Twilio_Careers/jobs' },
    { name: 'Okta', url: 'https://okta.wd5.myworkdayjobs.com/Okta_Careers/jobs' },
    { name: 'Cloudflare', url: 'https://cloudflare.wd5.myworkdayjobs.com/Cloudflare_Careers/jobs' },
    { name: 'Shopify', url: 'https://shopify.wd5.myworkdayjobs.com/Shopify_Careers/jobs' },
    { name: 'Square', url: 'https://block.wd5.myworkdayjobs.com/Block_Careers/jobs' },
    { name: 'Stripe', url: 'https://stripe.wd5.myworkdayjobs.com/Stripe_Careers/jobs' },
    { name: 'Coinbase', url: 'https://coinbase.wd5.myworkdayjobs.com/Coinbase_Careers/jobs' },
    { name: 'Robinhood', url: 'https://robinhood.wd5.myworkdayjobs.com/Robinhood_Careers/jobs' },
    { name: 'Airbnb', url: 'https://airbnb.wd5.myworkdayjobs.com/Airbnb_Careers/jobs' },
    { name: 'Uber', url: 'https://uber.wd5.myworkdayjobs.com/Uber_Careers/jobs' },
    { name: 'Lyft', url: 'https://lyft.wd5.myworkdayjobs.com/Lyft_Careers/jobs' },
    { name: 'DoorDash', url: 'https://doordash.wd5.myworkdayjobs.com/DoorDash_Careers/jobs' },
    { name: 'Instacart', url: 'https://instacart.wd5.myworkdayjobs.com/Instacart_Careers/jobs' },
    { name: 'Pinterest', url: 'https://pinterest.wd5.myworkdayjobs.com/Pinterest_Careers/jobs' },
    { name: 'Reddit', url: 'https://reddit.wd5.myworkdayjobs.com/Reddit_Careers/jobs' },
    { name: 'Discord', url: 'https://discord.wd5.myworkdayjobs.com/Discord_Careers/jobs' },
    { name: 'Slack', url: 'https://slack.wd5.myworkdayjobs.com/Slack_Careers/jobs' },
    { name: 'Zoom', url: 'https://zoom.wd5.myworkdayjobs.com/Zoom_Careers/jobs' },
    { name: 'Dropbox', url: 'https://dropbox.wd5.myworkdayjobs.com/Dropbox_Careers/jobs' },
    { name: 'Box', url: 'https://box.wd5.myworkdayjobs.com/Box_Careers/jobs' },
    { name: 'DocuSign', url: 'https://docusign.wd5.myworkdayjobs.com/DocuSign_Careers/jobs' },
    { name: 'ZoomInfo', url: 'https://zoominfo.wd5.myworkdayjobs.com/ZoomInfo_Careers/jobs' },
    { name: 'Gong', url: 'https://gong.wd5.myworkdayjobs.com/Gong_Careers/jobs' },
    { name: 'Outreach', url: 'https://outreach.wd5.myworkdayjobs.com/Outreach_Careers/jobs' },
    { name: 'Notion', url: 'https://notion.wd5.myworkdayjobs.com/Notion_Careers/jobs' },
    { name: 'Figma', url: 'https://figma.wd5.myworkdayjobs.com/Figma_Careers/jobs' },
    { name: 'Vercel', url: 'https://vercel.wd5.myworkdayjobs.com/Vercel_Careers/jobs' },
    { name: 'Linear', url: 'https://linear.wd5.myworkdayjobs.com/Linear_Careers/jobs' },
    { name: 'Ramp', url: 'https://ramp.wd5.myworkdayjobs.com/Ramp_Careers/jobs' },
    { name: 'Mercury', url: 'https://mercury.wd5.myworkdayjobs.com/Mercury_Careers/jobs' },
    { name: 'Brex', url: 'https://brex.wd5.myworkdayjobs.com/Brex_Careers/jobs' },
    { name: 'Affirm', url: 'https://affirm.wd5.myworkdayjobs.com/Affirm_Careers/jobs' },
    { name: 'Chime', url: 'https://chime.wd5.myworkdayjobs.com/Chime_Careers/jobs' },
    { name: 'Plaid', url: 'https://plaid.wd5.myworkdayjobs.com/Plaid_Careers/jobs' },
    { name: 'Vanta', url: 'https://vanta.wd5.myworkdayjobs.com/Vanta_Careers/jobs' },
    { name: 'Sierra', url: 'https://sierra.wd5.myworkdayjobs.com/Sierra_Careers/jobs' },
    { name: 'Deel', url: 'https://deel.wd5.myworkdayjobs.com/Deel_Careers/jobs' },
    { name: 'Remote', url: 'https://remote.wd5.myworkdayjobs.com/Remote_Careers/jobs' },
    { name: 'Verkada', url: 'https://verkada.wd5.myworkdayjobs.com/Verkada_Careers/jobs' },
    { name: 'Cohere', url: 'https://cohere.wd5.myworkdayjobs.com/Cohere_Careers/jobs' },
    { name: 'Perplexity', url: 'https://perplexity.wd5.myworkdayjobs.com/Perplexity_Careers/jobs' },
    { name: 'Replit', url: 'https://replit.wd5.myworkdayjobs.com/Replit_Careers/jobs' },
    { name: 'Anthropic', url: 'https://anthropic.wd5.myworkdayjobs.com/Anthropic_Careers/jobs' },
    { name: 'OpenAI', url: 'https://openai.wd5.myworkdayjobs.com/OpenAI_Careers/jobs' },
    { name: 'HuggingFace', url: 'https://huggingface.wd5.myworkdayjobs.com/HuggingFace_Careers/jobs' },
    { name: 'WeightsAndBiases', url: 'https://wandb.wd5.myworkdayjobs.com/WandB_Careers/jobs' },
    { name: 'Replicate', url: 'https://replicate.wd5.myworkdayjobs.com/Replicate_Careers/jobs' },
    { name: 'Modal', url: 'https://modal.wd5.myworkdayjobs.com/Modal_Careers/jobs' },
    { name: 'Prefect', url: 'https://prefect.wd5.myworkdayjobs.com/Prefect_Careers/jobs' },
    { name: 'Dagster', url: 'https://dagster.wd5.myworkdayjobs.com/Dagster_Careers/jobs' },
    { name: 'Temporal', url: 'https://temporal.wd5.myworkdayjobs.com/Temporal_Careers/jobs' },
    { name: 'Flyte', url: 'https://flyte.wd5.myworkdayjobs.com/Flyte_Careers/jobs' },
    { name: 'Metaflow', url: 'https://metaflow.wd5.myworkdayjobs.com/Metaflow_Careers/jobs' },
    { name: 'ZenML', url: 'https://zenml.wd5.myworkdayjobs.com/ZenML_Careers/jobs' },
    { name: 'Airbyte', url: 'https://airbyte.wd5.myworkdayjobs.com/Airbyte_Careers/jobs' },
    { name: 'Fivetran', url: 'https://fivetran.wd5.myworkdayjobs.com/Fivetran_Careers/jobs' },
    { name: 'Segment', url: 'https://segment.wd5.myworkdayjobs.com/Segment_Careers/jobs' },
    { name: 'Mparticle', url: 'https://mparticle.wd5.myworkdayjobs.com/Mparticle_Careers/jobs' },
    { name: 'Amplitude', url: 'https://amplitude.wd5.myworkdayjobs.com/Amplitude_Careers/jobs' },
    { name: 'Mixpanel', url: 'https://mixpanel.wd5.myworkdayjobs.com/Mixpanel_Careers/jobs' },
    { name: 'Heap', url: 'https://heap.wd5.myworkdayjobs.com/Heap_Careers/jobs' },
    { name: 'Pendo', url: 'https://pendo.wd5.myworkdayjobs.com/Pendo_Careers/jobs' },
    { name: 'FullStory', url: 'https://fullstory.wd5.myworkdayjobs.com/FullStory_Careers/jobs' },
    { name: 'LogRocket', url: 'https://logrocket.wd5.myworkdayjobs.com/LogRocket_Careers/jobs' },
    { name: 'Sentry', url: 'https://sentry.wd5.myworkdayjobs.com/Sentry_Careers/jobs' },
    { name: 'NewRelic', url: 'https://newrelic.wd5.myworkdayjobs.com/NewRelic_Careers/jobs' },
    { name: 'Datadog', url: 'https://datadog.wd5.myworkdayjobs.com/Datadog_Careers/jobs' },
    { name: 'Splunk', url: 'https://splunk.wd5.myworkdayjobs.com/Splunk_Careers/jobs' },
    { name: 'SumoLogic', url: 'https://sumologic.wd5.myworkdayjobs.com/SumoLogic_Careers/jobs' },
    { name: 'Honeycomb', url: 'https://honeycomb.wd5.myworkdayjobs.com/Honeycomb_Careers/jobs' },
    { name: 'Lightstep', url: 'https://lightstep.wd5.myworkdayjobs.com/Lightstep_Careers/jobs' },
    { name: 'Grafana', url: 'https://grafana.wd5.myworkdayjobs.com/Grafana_Careers/jobs' },
    { name: 'Cortex', url: 'https://cortex.wd5.myworkdayjobs.com/Cortex_Careers/jobs' },
    { name: 'Signoz', url: 'https://signoz.wd5.myworkdayjobs.com/Signoz_Careers/jobs' },
    { name: 'Checkly', url: 'https://checkly.wd5.myworkdayjobs.com/Checkly_Careers/jobs' },
    { name: 'BetterUptime', url: 'https://betteruptime.wd5.myworkdayjobs.com/BetterUptime_Careers/jobs' },
    { name: 'PagerDuty', url: 'https://pagerduty.wd5.myworkdayjobs.com/PagerDuty_Careers/jobs' },
    { name: 'Opsgenie', url: 'https://opsgenie.wd5.myworkdayjobs.com/Opsgenie_Careers/jobs' },
    { name: 'VictorOps', url: 'https://victorops.wd5.myworkdayjobs.com/VictorOps_Careers/jobs' },
    { name: 'Xmatters', url: 'https://xmatters.wd5.myworkdayjobs.com/Xmatters_Careers/jobs' },
    { name: 'AlertLogic', url: 'https://alertlogic.wd5.myworkdayjobs.com/AlertLogic_Careers/jobs' },
    { name: 'Blameless', url: 'https://blameless.wd5.myworkdayjobs.com/Blameless_Careers/jobs' },
    { name: 'FireHydrant', url: 'https://firehydrant.wd5.myworkdayjobs.com/FireHydrant_Careers/jobs' },
    { name: 'IncidentIO', url: 'https://incidentio.wd5.myworkdayjobs.com/IncidentIO_Careers/jobs' },
    { name: 'Rootly', url: 'https://rootly.wd5.myworkdayjobs.com/Rootly_Careers/jobs' },
    { name: 'Zenduty', url: 'https://zenduty.wd5.myworkdayjobs.com/Zenduty_Careers/jobs' },
    { name: 'Quadratic', url: 'https://quadratic.wd5.myworkdayjobs.com/Quadratic_Careers/jobs' },
    // More Workday companies
    { name: 'Palantir', url: 'https://palantir.wd5.myworkdayjobs.com/Palantir_Careers/jobs' },
    { name: 'Anduril', url: 'https://anduril.wd5.myworkdayjobs.com/Anduril_Careers/jobs' },
    { name: 'SpaceX', url: 'https://spacex.wd5.myworkdayjobs.com/SpaceX_Careers/jobs' },
    { name: 'BlueOrigin', url: 'https://blueorigin.wd5.myworkdayjobs.com/BlueOrigin_Careers/jobs' },
    { name: 'RelativitySpace', url: 'https://relativityspace.wd5.myworkdayjobs.com/RelativitySpace_Careers/jobs' },
    { name: 'RocketLab', url: 'https://rocketlab.wd5.myworkdayjobs.com/RocketLab_Careers/jobs' },
    { name: 'PlanetLabs', url: 'https://planetlabs.wd5.myworkdayjobs.com/PlanetLabs_Careers/jobs' },
    { name: 'Maxar', url: 'https://maxar.wd5.myworkdayjobs.com/Maxar_Careers/jobs' },
    { name: 'BlackSky', url: 'https://blacksky.wd5.myworkdayjobs.com/BlackSky_Careers/jobs' },
    { name: 'Spire', url: 'https://spire.wd5.myworkdayjobs.com/Spire_Careers/jobs' },
    { name: 'CapellaSpace', url: 'https://capellaspace.wd5.myworkdayjobs.com/CapellaSpace_Careers/jobs' },
    { name: 'UrsaSpace', url: 'https://ursaspace.wd5.myworkdayjobs.com/UrsaSpace_Careers/jobs' },
    { name: 'HawkEye360', url: 'https://hawkeye360.wd5.myworkdayjobs.com/HawkEye360_Careers/jobs' },
    { name: 'Astranis', url: 'https://astranis.wd5.myworkdayjobs.com/Astranis_Careers/jobs' },
    { name: 'VardaSpace', url: 'https://vardaspace.wd5.myworkdayjobs.com/VardaSpace_Careers/jobs' },
    { name: 'ImpulseSpace', url: 'https://impulsespace.wd5.myworkdayjobs.com/ImpulseSpace_Careers/jobs' },
    { name: 'AstroForge', url: 'https://astroforge.wd5.myworkdayjobs.com/AstroForge_Careers/jobs' },
    { name: 'OrbitalSidekick', url: 'https://orbitalsidekick.wd5.myworkdayjobs.com/OrbitalSidekick_Careers/jobs' },
    { name: 'Synspective', url: 'https://synspective.wd5.myworkdayjobs.com/Synspective_Careers/jobs' },
    { name: 'Iceye', url: 'https://iceye.wd5.myworkdayjobs.com/Iceye_Careers/jobs' },
    { name: 'Satellogic', url: 'https://satellogic.wd5.myworkdayjobs.com/Satellogic_Careers/jobs' },
    { name: 'Albedo', url: 'https://albedo.wd5.myworkdayjobs.com/Albedo_Careers/jobs' },
    { name: 'Umbral', url: 'https://umbral.wd5.myworkdayjobs.com/Umbral_Careers/jobs' },
    { name: 'AxiomSpace', url: 'https://axiomspace.wd5.myworkdayjobs.com/AxiomSpace_Careers/jobs' },
    { name: 'SierraSpace', url: 'https://sierraspace.wd5.myworkdayjobs.com/SierraSpace_Careers/jobs' },
    { name: 'Gravitics', url: 'https://gravitics.wd5.myworkdayjobs.com/Gravitics_Careers/jobs' },
    { name: 'OrbitalAssembly', url: 'https://orbitalassembly.wd5.myworkdayjobs.com/OrbitalAssembly_Careers/jobs' },
    { name: 'AboveSpace', url: 'https://abovespace.wd5.myworkdayjobs.com/AboveSpace_Careers/jobs' },
    { name: 'OrbitalReef', url: 'https://orbitalreef.wd5.myworkdayjobs.com/OrbitalReef_Careers/jobs' },
    { name: 'Starlab', url: 'https://starlab.wd5.myworkdayjobs.com/Starlab_Careers/jobs' },
    { name: 'Nanoracks', url: 'https://nanoracks.wd5.myworkdayjobs.com/Nanoracks_Careers/jobs' },
    { name: 'VoyagerSpace', url: 'https://voyagerspace.wd5.myworkdayjobs.com/VoyagerSpace_Careers/jobs' },
    { name: 'LockheedMartin', url: 'https://lockheedmartin.wd5.myworkdayjobs.com/LockheedMartin_Careers/jobs' },
    { name: 'Boeing', url: 'https://boeing.wd5.myworkdayjobs.com/Boeing_Careers/jobs' },
    { name: 'NorthropGrumman', url: 'https://northropgrumman.wd5.myworkdayjobs.com/NorthropGrumman_Careers/jobs' },
    { name: 'Raytheon', url: 'https://raytheon.wd5.myworkdayjobs.com/Raytheon_Careers/jobs' },
    { name: 'GeneralDynamics', url: 'https://generaldynamics.wd5.myworkdayjobs.com/GeneralDynamics_Careers/jobs' },
    { name: 'L3Harris', url: 'https://l3harris.wd5.myworkdayjobs.com/L3Harris_Careers/jobs' },
    { name: 'BAESystems', url: 'https://baesystems.wd5.myworkdayjobs.com/BAESystems_Careers/jobs' },
    { name: 'HuntingtonIngalls', url: 'https://huntingtoningalls.wd5.myworkdayjobs.com/HuntingtonIngalls_Careers/jobs' },
    { name: 'Leidos', url: 'https://leidos.wd5.myworkdayjobs.com/Leidos_Careers/jobs' },
    { name: 'BoozAllen', url: 'https://boozallen.wd5.myworkdayjobs.com/BoozAllen_Careers/jobs' },
    { name: 'SAIC', url: 'https://saic.wd5.myworkdayjobs.com/SAIC_Careers/jobs' },
    { name: 'CACI', url: 'https://caci.wd5.myworkdayjobs.com/CACI_Careers/jobs' },
    { name: 'Parsons', url: 'https://parsons.wd5.myworkdayjobs.com/Parsons_Careers/jobs' },
    { name: 'KBR', url: 'https://kbr.wd5.myworkdayjobs.com/KBR_Careers/jobs' },
    { name: 'Jacobs', url: 'https://jacobs.wd5.myworkdayjobs.com/Jacobs_Careers/jobs' },
    { name: 'AECOM', url: 'https://aecom.wd5.myworkdayjobs.com/AECOM_Careers/jobs' },
    { name: 'Fluor', url: 'https://fluor.wd5.myworkdayjobs.com/Fluor_Careers/jobs' },
    { name: 'Bechtel', url: 'https://bechtel.wd5.myworkdayjobs.com/Bechtel_Careers/jobs' },
    { name: 'Kiewit', url: 'https://kiewit.wd5.myworkdayjobs.com/Kiewit_Careers/jobs' },
    { name: 'Turner', url: 'https://turner.wd5.myworkdayjobs.com/Turner_Careers/jobs' },
    { name: 'Clark', url: 'https://clark.wd5.myworkdayjobs.com/Clark_Careers/jobs' },
    { name: 'HenselPhelps', url: 'https://henselphelps.wd5.myworkdayjobs.com/HenselPhelps_Careers/jobs' },
    { name: 'WhitingTurner', url: 'https://whitingturner.wd5.myworkdayjobs.com/WhitingTurner_Careers/jobs' },
    { name: 'Gilbane', url: 'https://gilbane.wd5.myworkdayjobs.com/Gilbane_Careers/jobs' },
    { name: 'Suffolk', url: 'https://suffolk.wd5.myworkdayjobs.com/Suffolk_Careers/jobs' },
    { name: 'McCarthy', url: 'https://mccarthy.wd5.myworkdayjobs.com/McCarthy_Careers/jobs' },
    { name: 'Mortenson', url: 'https://mortenson.wd5.myworkdayjobs.com/Mortenson_Careers/jobs' },
    { name: 'PCL', url: 'https://pcl.wd5.myworkdayjobs.com/PCL_Careers/jobs' },
    { name: 'HathawayDinwiddie', url: 'https://hathawaydinwiddie.wd5.myworkdayjobs.com/HathawayDinwiddie_Careers/jobs' },
    { name: 'Webcor', url: 'https://webcor.wd5.myworkdayjobs.com/Webcor_Careers/jobs' },
    { name: 'DPR', url: 'https://dpr.wd5.myworkdayjobs.com/DPR_Careers/jobs' },
    { name: 'Swinterton', url: 'https://swinterton.wd5.myworkdayjobs.com/Swinterton_Careers/jobs' },
    { name: 'BalfourBeatty', url: 'https://balfourbeatty.wd5.myworkdayjobs.com/BalfourBeatty_Careers/jobs' },
    { name: 'Skanska', url: 'https://skanska.wd5.myworkdayjobs.com/Skanska_Careers/jobs' },
    { name: 'Turner', url: 'https://turnerconstruction.wd5.myworkdayjobs.com/TurnerConstruction_Careers/jobs' },
    { name: 'ClarkConstruction', url: 'https://clarkconstruction.wd5.myworkdayjobs.com/ClarkConstruction_Careers/jobs' },
    { name: 'HenselPhelpsConstruction', url: 'https://henselphelpsconstruction.wd5.myworkdayjobs.com/HenselPhelpsConstruction_Careers/jobs' },
    { name: 'WhitingTurnerContracting', url: 'https://whitingturnercontracting.wd5.myworkdayjobs.com/WhitingTurnerContracting_Careers/jobs' },
    { name: 'GilbaneBuilding', url: 'https://gilbanebuilding.wd5.myworkdayjobs.com/GilbaneBuilding_Careers/jobs' },
    { name: 'SuffolkConstruction', url: 'https://suffolkconstruction.wd5.myworkdayjobs.com/SuffolkConstruction_Careers/jobs' },
    { name: 'McCarthyBuilding', url: 'https://mccarthybuilding.wd5.myworkdayjobs.com/McCarthyBuilding_Careers/jobs' },
    { name: 'MortensonConstruction', url: 'https://mortensonconstruction.wd5.myworkdayjobs.com/MortensonConstruction_Careers/jobs' },
    { name: 'PCLConstruction', url: 'https://pclconstruction.wd5.myworkdayjobs.com/PCLConstruction_Careers/jobs' },
    { name: 'HathawayDinwiddieConstruction', url: 'https://hathawaydinwiddieconstruction.wd5.myworkdayjobs.com/HathawayDinwiddieConstruction_Careers/jobs' },
    { name: 'WebcorBuilders', url: 'https://webcorbuilders.wd5.myworkdayjobs.com/WebcorBuilders_Careers/jobs' },
    { name: 'DPRConstruction', url: 'https://dprconstruction.wd5.myworkdayjobs.com/DPRConstruction_Careers/jobs' },
    { name: 'SwintertonBuilders', url: 'https://swintertonbuilders.wd5.myworkdayjobs.com/SwintertonBuilders_Careers/jobs' },
    { name: 'BalfourBeattyConstruction', url: 'https://balfourbeattyconstruction.wd5.myworkdayjobs.com/BalfourBeattyConstruction_Careers/jobs' },
    { name: 'SkanskaUSA', url: 'https://skanskausa.wd5.myworkdayjobs.com/SkanskaUSA_Careers/jobs' },
  ]

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const results = await Promise.all(
      this.companies.map(async company => {
        try {
          const jobs = await this.fetchCompanyJobs(company)
          return jobs.filter(job => this.matchesFilters(job, filters))
        } catch (error) {
          console.error(`Error fetching jobs for ${company.name}:`, error)
          return []
        }
      })
    )
    return results.flat()
  }

  private async fetchCompanyJobs(company: { name: string; url: string }): Promise<RawJob[]> {
    try {
      const response = await fetch(company.url, {
        headers: {
          'User-Agent': 'JobMatch AI Bot',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.log(`${company.name}: ${response.status} - skipping`)
        return []
      }

      const data = (await response.json()) as CompanyJobsPayload
      return this.parseCompanyJobs(data, company.name)
    } catch (error) {
      console.error(`Failed to fetch ${company.name}:`, error)
      return []
    }
  }

  private async parseCompanyJobs(data: CompanyJobsPayload, companyName: string): Promise<RawJob[]> {
    // Different companies have different API response structures
    // This is a generic parser - in production, you'd have company-specific parsers
    let jobs: RawCompanyJob[] = []

    if (Array.isArray(data)) {
      jobs = data
    } else if (data.jobs) {
      jobs = data.jobs
    } else if (data.results) {
      jobs = data.results
    } else if (data.data) {
      jobs = data.data
    } else if (data.postings) {
      jobs = data.postings
    }

    const parsedJobs = await Promise.all(
      jobs.map(job => this.parseCompanyJob(job, companyName))
    )

    return parsedJobs.filter((job): job is RawJob => job !== null)
  }

  private async parseCompanyJob(job: RawCompanyJob, companyName: string): Promise<RawJob | null> {
    try {
      const title = job.title || job.name || job.position_title || ''
      if (!title) return null

      const description = job.description || job.descriptionPlain || job.content || job.body || ''

      return this.parseJob({
        id: job.id || job.jobId || job.reqId || Math.random().toString(36).substring(7),
        title,
        company: companyName,
        location: job.location || job.locationName || job.city || 'Remote',
        isRemote: this.isRemote(job),
        description,
        requirements: this.extractRequirements(description),
        skills: await this.extractSkills(description),
        experienceLevel: job.experienceLevel || job.seniority || job.level || '',
        roleType: '',
        salaryMin: job.salaryMin || job.minSalary || job.compensationMin,
        salaryMax: job.salaryMax || job.maxSalary || job.compensationMax,
        currency: job.currency || 'USD',
        // Build the apply URL from real fields only — never synthesize a
        // careers-homepage fallback. Amazon returns a relative job_path that
        // points at the public detail page (the safe, non-login Apply target).
        applyUrl:
          job.url_next_step ||
          (job.job_path ? `https://www.amazon.jobs${job.job_path}` : '') ||
          job.applyUrl ||
          job.url ||
          job.applicationUrl ||
          job.careerSiteUrl ||
          '',
        postedAt: job.postedAt || job.createdAt || job.datePosted || new Date(),
        expiresAt: job.expiresAt || job.expirationDate,
      })
    } catch {
      return null
    }
  }

  private isRemote(job: RawCompanyJob): boolean {
    const location = (job.location || job.locationName || '').toLowerCase()
    return location.includes('remote') || location.includes('anywhere') || job.isRemote === true
  }
}

export const companyDirectProvider = new CompanyDirectProvider()