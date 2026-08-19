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
    // Fintech & Financial Services
    { name: 'PayPal', url: 'https://paypal.wd5.myworkdayjobs.com/PayPal_Careers/jobs' },
    { name: 'Venmo', url: 'https://venmo.wd5.myworkdayjobs.com/Venmo_Careers/jobs' },
    { name: 'Wise', url: 'https://wise.wd5.myworkdayjobs.com/Wise_Careers/jobs' },
    { name: 'Revolut', url: 'https://revolut.wd5.myworkdayjobs.com/Revolut_Careers/jobs' },
    { name: 'StripeTreasury', url: 'https://stripetreasury.wd5.myworkdayjobs.com/StripeTreasury_Careers/jobs' },
    { name: 'Block', url: 'https://block.wd5.myworkdayjobs.com/Block_Careers/jobs' },
    { name: 'CashApp', url: 'https://cashapp.wd5.myworkdayjobs.com/CashApp_Careers/jobs' },
    { name: 'SoFi', url: 'https://sofi.wd5.myworkdayjobs.com/SoFi_Careers/jobs' },
    { name: 'RobinhoodMarkets', url: 'https://robinhoodmarkets.wd5.myworkdayjobs.com/RobinhoodMarkets_Careers/jobs' },
    { name: 'CoinbasePrime', url: 'https://coinbaseprime.wd5.myworkdayjobs.com/CoinbasePrime_Careers/jobs' },
    { name: 'Kraken', url: 'https://kraken.wd5.myworkdayjobs.com/Kraken_Careers/jobs' },
    { name: 'Gemini', url: 'https://gemini.wd5.myworkdayjobs.com/Gemini_Careers/jobs' },
    { name: 'Circle', url: 'https://circle.wd5.myworkdayjobs.com/Circle_Careers/jobs' },
    { name: 'Intuit', url: 'https://intuit.wd5.myworkdayjobs.com/Intuit_Careers/jobs' },
    { name: 'Fiserv', url: 'https://fiserv.wd5.myworkdayjobs.com/Fiserv_Careers/jobs' },
    { name: 'Fidelity', url: 'https://fidelity.wd5.myworkdayjobs.com/Fidelity_Careers/jobs' },
    { name: 'CapitalOne', url: 'https://capitalone.wd5.myworkdayjobs.com/Capital_One_Careers/jobs' },
    { name: 'AmericanExpress', url: 'https://americanexpress.wd5.myworkdayjobs.com/American_Express_Careers/jobs' },
    { name: 'JPMorganChase', url: 'https://jpmorganchase.wd5.myworkdayjobs.com/JPMC_Careers/jobs' },
    { name: 'GoldmanSachs', url: 'https://goldmansachs.wd5.myworkdayjobs.com/Goldman_Sachs_Careers/jobs' },
    { name: 'MorganStanley', url: 'https://morganstanley.wd5.myworkdayjobs.com/Morgan_Stanley_Careers/jobs' },
    { name: 'Citigroup', url: 'https://citigroup.wd5.myworkdayjobs.com/Citi_Careers/jobs' },
    { name: 'BankOfAmerica', url: 'https://bankofamerica.wd5.myworkdayjobs.com/BOA_Careers/jobs' },
    { name: 'WellsFargo', url: 'https://wellsfargo.wd5.myworkdayjobs.com/Wells_Fargo_Careers/jobs' },
    { name: 'CharlesSchwab', url: 'https://charlesschwab.wd5.myworkdayjobs.com/Charles_Schwab_Careers/jobs' },
    { name: 'Visa', url: 'https://visa.wd5.myworkdayjobs.com/Visa_Careers/jobs' },
    { name: 'Mastercard', url: 'https://mastercard.wd5.myworkdayjobs.com/Mastercard_Careers/jobs' },
    // E-commerce & Retail Tech
    { name: 'Walmart', url: 'https://walmart.wd5.myworkdayjobs.com/Walmart_Careers/jobs' },
    { name: 'Target', url: 'https://target.wd5.myworkdayjobs.com/Target_Careers/jobs' },
    { name: 'BestBuy', url: 'https://bestbuy.wd5.myworkdayjobs.com/BestBuy_Careers/jobs' },
    { name: 'Costco', url: 'https://costco.wd5.myworkdayjobs.com/Costco_Careers/jobs' },
    { name: 'eBay', url: 'https://ebay.wd5.myworkdayjobs.com/eBay_Careers/jobs' },
    { name: 'Etsy', url: 'https://etsy.wd5.myworkdayjobs.com/Etsy_Careers/jobs' },
    { name: 'Wayfair', url: 'https://wayfair.wd5.myworkdayjobs.com/Wayfair_Careers/jobs' },
    { name: 'Chewy', url: 'https://chewy.wd5.myworkdayjobs.com/Chewy_Careers/jobs' },
    { name: 'InstacartPlus', url: 'https://instacartplus.wd5.myworkdayjobs.com/InstacartPlus_Careers/jobs' },
    { name: 'Grubhub', url: 'https://grubhub.wd5.myworkdayjobs.com/Grubhub_Careers/jobs' },
    { name: 'Postmates', url: 'https://postmates.wd5.myworkdayjobs.com/Postmates_Careers/jobs' },
    { name: 'UberEats', url: 'https://ubereats.wd5.myworkdayjobs.com/UberEats_Careers/jobs' },
    // Healthcare & Biotech
    { name: 'ThermoFisher', url: 'https://thermofisher.wd5.myworkdayjobs.com/Thermo_Fisher_Careers/jobs' },
    { name: 'Illumina', url: 'https://illumina.wd5.myworkdayjobs.com/Illumina_Careers/jobs' },
    { name: 'Genentech', url: 'https://genentech.wd5.myworkdayjobs.com/Genentech_Careers/jobs' },
    { name: 'Gilead', url: 'https://gilead.wd5.myworkdayjobs.com/Gilead_Careers/jobs' },
    { name: 'Amgen', url: 'https://amgen.wd5.myworkdayjobs.com/Amgen_Careers/jobs' },
    { name: 'Pfizer', url: 'https://pfizer.wd5.myworkdayjobs.com/Pfizer_Careers/jobs' },
    { name: 'Moderna', url: 'https://moderna.wd5.myworkdayjobs.com/Moderna_Careers/jobs' },
    { name: 'JohnsonJohnson', url: 'https://johnsonjohnson.wd5.myworkdayjobs.com/Johnson_Johnson_Careers/jobs' },
    { name: 'UnitedHealth', url: 'https://unitedhealth.wd5.myworkdayjobs.com/UnitedHealth_Careers/jobs' },
    { name: 'CVSHealth', url: 'https://cvshealth.wd5.myworkdayjobs.com/CVS_Health_Careers/jobs' },
    { name: 'Optum', url: 'https://optum.wd5.myworkdayjobs.com/Optum_Careers/jobs' },
    { name: 'Anthem', url: 'https://anthem.wd5.myworkdayjobs.com/Anthem_Careers/jobs' },
    { name: 'Cigna', url: 'https://cigna.wd5.myworkdayjobs.com/Cigna_Careers/jobs' },
    { name: 'Humana', url: 'https://humana.wd5.myworkdayjobs.com/Humana_Careers/jobs' },
    { name: 'Tempus', url: 'https://tempus.wd5.myworkdayjobs.com/Tempus_Careers/jobs' },
    { name: '23andMe', url: 'https://23andme.wd5.myworkdayjobs.com/23andMe_Careers/jobs' },
    { name: 'Color', url: 'https://color.wd5.myworkdayjobs.com/Color_Careers/jobs' },
    { name: 'Guardant', url: 'https://guardant.wd5.myworkdayjobs.com/Guardant_Careers/jobs' },
    { name: 'Grail', url: 'https://grail.wd5.myworkdayjobs.com/Grail_Careers/jobs' },
    { name: 'Insitro', url: 'https://insitro.wd5.myworkdayjobs.com/Insitro_Careers/jobs' },
    { name: 'Recursion', url: 'https://recursion.wd5.myworkdayjobs.com/Recursion_Careers/jobs' },
    // Enterprise SaaS & Cloud
    { name: 'Workday', url: 'https://workday.wd5.myworkdayjobs.com/Workday_Careers/jobs' },
    { name: 'SalesforceCommerce', url: 'https://salesforcecommerce.wd5.myworkdayjobs.com/Salesforce_Commerce_Careers/jobs' },
    { name: 'ServiceTitan', url: 'https://servicetitan.wd5.myworkdayjobs.com/ServiceTitan_Careers/jobs' },
    { name: 'Procore', url: 'https://procore.wd5.myworkdayjobs.com/Procore_Careers/jobs' },
    { name: 'Asana', url: 'https://asana.wd5.myworkdayjobs.com/Asana_Careers/jobs' },
    { name: 'Monday', url: 'https://monday.wd5.myworkdayjobs.com/Monday_Careers/jobs' },
    { name: 'Smartsheet', url: 'https://smartsheet.wd5.myworkdayjobs.com/Smartsheet_Careers/jobs' },
    { name: 'AtlassianDev', url: 'https://atlassiandev.wd5.myworkdayjobs.com/Atlassian_Dev_Careers/jobs' },
    { name: 'Zendesk', url: 'https://zendesk.wd5.myworkdayjobs.com/Zendesk_Careers/jobs' },
    { name: 'Intercom', url: 'https://intercom.wd5.myworkdayjobs.com/Intercom_Careers/jobs' },
    { name: 'Front', url: 'https://front.wd5.myworkdayjobs.com/Front_Careers/jobs' },
    { name: 'Drift', url: 'https://drift.wd5.myworkdayjobs.com/Drift_Careers/jobs' },
    { name: 'HubSpot', url: 'https://hubspot.wd5.myworkdayjobs.com/HubSpot_Careers/jobs' },
    { name: 'Marketo', url: 'https://marketo.wd5.myworkdayjobs.com/Marketo_Careers/jobs' },
    { name: 'Pendo', url: 'https://pendo.wd5.myworkdayjobs.com/Pendo_Careers/jobs' },
    { name: 'Salesloft', url: 'https://salesloft.wd5.myworkdayjobs.com/Salesloft_Careers/jobs' },
    { name: 'OutreachIO', url: 'https://outreachio.wd5.myworkdayjobs.com/OutreachIO_Careers/jobs' },
    { name: 'Gainsight', url: 'https://gainsight.wd5.myworkdayjobs.com/Gainsight_Careers/jobs' },
    // Gaming & Entertainment
    { name: 'EpicGames', url: 'https://epicgames.wd5.myworkdayjobs.com/Epic_Games_Careers/jobs' },
    { name: 'RiotGames', url: 'https://riotgames.wd5.myworkdayjobs.com/Riot_Games_Careers/jobs' },
    { name: 'Unity', url: 'https://unity.wd5.myworkdayjobs.com/Unity_Careers/jobs' },
    { name: 'Roblox', url: 'https://roblox.wd5.myworkdayjobs.com/Roblox_Careers/jobs' },
    { name: 'EA', url: 'https://ea.wd5.myworkdayjobs.com/EA_Careers/jobs' },
    { name: 'Activision', url: 'https://activision.wd5.myworkdayjobs.com/Activision_Careers/jobs' },
    { name: 'Blizzard', url: 'https://blizzard.wd5.myworkdayjobs.com/Blizzard_Careers/jobs' },
    { name: 'Bungie', url: 'https://bungie.wd5.myworkdayjobs.com/Bungie_Careers/jobs' },
    { name: 'Steam', url: 'https://steam.wd5.myworkdayjobs.com/Steam_Careers/jobs' },
    { name: 'Twitch', url: 'https://twitch.wd5.myworkdayjobs.com/Twitch_Careers/jobs' },
    { name: 'Spotify', url: 'https://spotify.wd5.myworkdayjobs.com/Spotify_Careers/jobs' },
    { name: 'Pandora', url: 'https://pandora.wd5.myworkdayjobs.com/Pandora_Careers/jobs' },
    { name: 'SoundCloud', url: 'https://soundcloud.wd5.myworkdayjobs.com/SoundCloud_Careers/jobs' },
    // Automotive & Mobility
    { name: 'Rivian', url: 'https://rivian.wd5.myworkdayjobs.com/Rivian_Careers/jobs' },
    { name: 'Lucid', url: 'https://lucid.wd5.myworkdayjobs.com/Lucid_Careers/jobs' },
    { name: 'Cruise', url: 'https://cruise.wd5.myworkdayjobs.com/Cruise_Careers/jobs' },
    { name: 'Waymo', url: 'https://waymo.wd5.myworkdayjobs.com/Waymo_Careers/jobs' },
    { name: 'Zoox', url: 'https://zoox.wd5.myworkdayjobs.com/Zoox_Careers/jobs' },
    { name: 'Aurora', url: 'https://aurora.wd5.myworkdayjobs.com/Aurora_Careers/jobs' },
    { name: 'Argo', url: 'https://argo.wd5.myworkdayjobs.com/Argo_Careers/jobs' },
    { name: 'Motional', url: 'https://motional.wd5.myworkdayjobs.com/Motional_Careers/jobs' },
    { name: 'Nuro', url: 'https://nuro.wd5.myworkdayjobs.com/Nuro_Careers/jobs' },
    { name: 'TuSimple', url: 'https://tusimple.wd5.myworkdayjobs.com/TuSimple_Careers/jobs' },
    // Travel & Hospitality
    { name: 'AirbnbPlus', url: 'https://airbnbplus.wd5.myworkdayjobs.com/AirbnbPlus_Careers/jobs' },
    { name: 'Booking', url: 'https://booking.wd5.myworkdayjobs.com/Booking_Careers/jobs' },
    { name: 'Expedia', url: 'https://expedia.wd5.myworkdayjobs.com/Expedia_Careers/jobs' },
    { name: 'TripAdvisor', url: 'https://tripadvisor.wd5.myworkdayjobs.com/TripAdvisor_Careers/jobs' },
    { name: 'AirbnbLuxe', url: 'https://airbnbluxe.wd5.myworkdayjobs.com/AirbnbLuxe_Careers/jobs' },
    { name: 'Marriott', url: 'https://marriott.wd5.myworkdayjobs.com/Marriott_Careers/jobs' },
    { name: 'Hilton', url: 'https://hilton.wd5.myworkdayjobs.com/Hilton_Careers/jobs' },
    // Telecom & Media
    { name: 'Verizon', url: 'https://verizon.wd5.myworkdayjobs.com/Verizon_Careers/jobs' },
    { name: 'ATT', url: 'https://att.wd5.myworkdayjobs.com/ATT_Careers/jobs' },
    { name: 'T-Mobile', url: 'https://tmobile.wd5.myworkdayjobs.com/TMobile_Careers/jobs' },
    { name: 'Comcast', url: 'https://comcast.wd5.myworkdayjobs.com/Comcast_Careers/jobs' },
    { name: 'Charter', url: 'https://charter.wd5.myworkdayjobs.com/Charter_Careers/jobs' },
    { name: 'Disney', url: 'https://disney.wd5.myworkdayjobs.com/Disney_Careers/jobs' },
    { name: 'WarnerBros', url: 'https://warnerbros.wd5.myworkdayjobs.com/WarnerBros_Careers/jobs' },
    { name: 'NBCUniversal', url: 'https://nbcuniversal.wd5.myworkdayjobs.com/NBCUniversal_Careers/jobs' },
    { name: 'Paramount', url: 'https://paramount.wd5.myworkdayjobs.com/Paramount_Careers/jobs' },
    { name: 'NetflixGaming', url: 'https://netflixgaming.wd5.myworkdayjobs.com/NetflixGaming_Careers/jobs' },
    // AI & ML Research Labs
    { name: 'GoogleDeepMind', url: 'https://googledeepmind.wd5.myworkdayjobs.com/GoogleDeepMind_Careers/jobs' },
    { name: 'MetaAI', url: 'https://metaai.wd5.myworkdayjobs.com/MetaAI_Careers/jobs' },
    { name: 'MicrosoftResearch', url: 'https://microsoftresearch.wd5.myworkdayjobs.com/Microsoft_Research_Careers/jobs' },
    { name: 'NvidiaResearch', url: 'https://nvidia.wd5.myworkdayjobs.com/NvidiaResearch_Careers/jobs' },
    { name: 'AllenAI', url: 'https://allenai.wd5.myworkdayjobs.com/AllenAI_Careers/jobs' },
    { name: 'FAIR', url: 'https://fair.wd5.myworkdayjobs.com/FAIR_Careers/jobs' },
    { name: 'AnthropicSafety', url: 'https://anthropicsafety.wd5.myworkdayjobs.com/AnthropicSafety_Careers/jobs' },
    { name: 'OpenAISafety', url: 'https://openaisafety.wd5.myworkdayjobs.com/OpenAISafety_Careers/jobs' },
    { name: 'CohereForAI', url: 'https://cohereforai.wd5.myworkdayjobs.com/CohereForAI_Careers/jobs' },
    { name: 'Inflection', url: 'https://inflection.wd5.myworkdayjobs.com/Inflection_Careers/jobs' },
    { name: 'Mistral', url: 'https://mistral.wd5.myworkdayjobs.com/Mistral_Careers/jobs' },
    { name: 'StabilityAI', url: 'https://stabilityai.wd5.myworkdayjobs.com/StabilityAI_Careers/jobs' },
    { name: 'Adept', url: 'https://adept.wd5.myworkdayjobs.com/Adept_Careers/jobs' },
    { name: 'Character', url: 'https://character.wd5.myworkdayjobs.com/Character_Careers/jobs' },
    { name: 'InflectionAI', url: 'https://inflectionai.wd5.myworkdayjobs.com/InflectionAI_Careers/jobs' },
    { name: 'ElevenLabs', url: 'https://elevenlabs.wd5.myworkdayjobs.com/ElevenLabs_Careers/jobs' },
    { name: 'Runway', url: 'https://runway.wd5.myworkdayjobs.com/Runway_Careers/jobs' },
    { name: 'Pika', url: 'https://pika.wd5.myworkdayjobs.com/Pika_Careers/jobs' },
    { name: 'Midjourney', url: 'https://midjourney.wd5.myworkdayjobs.com/Midjourney_Careers/jobs' },
    { name: 'Synthesia', url: 'https://synthesia.wd5.myworkdayjobs.com/Synthesia_Careers/jobs' },
    { name: 'HeyGen', url: 'https://heygen.wd5.myworkdayjobs.com/HeyGen_Careers/jobs' },
    { name: 'Suno', url: 'https://suno.wd5.myworkdayjobs.com/Suno_Careers/jobs' },
    { name: 'Udio', url: 'https://udio.wd5.myworkdayjobs.com/Udio_Careers/jobs' },
    // Cloud Infrastructure & DevOps
    { name: 'DigitalOcean', url: 'https://digitalocean.wd5.myworkdayjobs.com/DigitalOcean_Careers/jobs' },
    { name: 'Linode', url: 'https://linode.wd5.myworkdayjobs.com/Linode_Careers/jobs' },
    { name: 'Vultr', url: 'https://vultr.wd5.myworkdayjobs.com/Vultr_Careers/jobs' },
    { name: 'Heroku', url: 'https://heroku.wd5.myworkdayjobs.com/Heroku_Careers/jobs' },
    { name: 'Netlify', url: 'https://netlify.wd5.myworkdayjobs.com/Netlify_Careers/jobs' },
    { name: 'Render', url: 'https://render.wd5.myworkdayjobs.com/Render_Careers/jobs' },
    { name: 'Fly', url: 'https://fly.wd5.myworkdayjobs.com/Fly_Careers/jobs' },
    { name: 'Railway', url: 'https://railway.wd5.myworkdayjobs.com/Railway_Careers/jobs' },
    { name: 'CloudflarePages', url: 'https://cloudflarepages.wd5.myworkdayjobs.com/CloudflarePages_Careers/jobs' },
    { name: 'Fastly', url: 'https://fastly.wd5.myworkdayjobs.com/Fastly_Careers/jobs' },
    { name: 'Akamai', url: 'https://akamai.wd5.myworkdayjobs.com/Akamai_Careers/jobs' },
    { name: 'CloudflareWorkers', url: 'https://cloudflareworkers.wd5.myworkdayjobs.com/CloudflareWorkers_Careers/jobs' },
    // Cybersecurity
    { name: 'CrowdStrike', url: 'https://crowdstrike.wd5.myworkdayjobs.com/CrowdStrike_Careers/jobs' },
    { name: 'PaloAlto', url: 'https://paloalto.wd5.myworkdayjobs.com/PaloAlto_Careers/jobs' },
    { name: 'Fortinet', url: 'https://fortinet.wd5.myworkdayjobs.com/Fortinet_Careers/jobs' },
    { name: 'Zscaler', url: 'https://zscaler.wd5.myworkdayjobs.com/Zscaler_Careers/jobs' },
    { name: 'OktaSecurity', url: 'https://oktasecurity.wd5.myworkdayjobs.com/OktaSecurity_Careers/jobs' },
    { name: 'Auth0', url: 'https://auth0.wd5.myworkdayjobs.com/Auth0_Careers/jobs' },
    { name: 'Duo', url: 'https://duo.wd5.myworkdayjobs.com/Duo_Careers/jobs' },
    { name: 'Tenable', url: 'https://tenable.wd5.myworkdayjobs.com/Tenable_Careers/jobs' },
    { name: 'Qualys', url: 'https://qualys.wd5.myworkdayjobs.com/Qualys_Careers/jobs' },
    { name: 'Rapid7', url: 'https://rapid7.wd5.myworkdayjobs.com/Rapid7_Careers/jobs' },
    { name: 'Cylance', url: 'https://cylance.wd5.myworkdayjobs.com/Cylance_Careers/jobs' },
    { name: 'CarbonBlack', url: 'https://carbonblack.wd5.myworkdayjobs.com/CarbonBlack_Careers/jobs' },
    { name: 'Tanium', url: 'https://tanium.wd5.myworkdayjobs.com/Tanium_Careers/jobs' },
    { name: 'Wiz', url: 'https://wiz.wd5.myworkdayjobs.com/Wiz_Careers/jobs' },
    { name: 'Lacework', url: 'https://lacework.wd5.myworkdayjobs.com/Lacework_Careers/jobs' },
    { name: 'Snyk', url: 'https://snyk.wd5.myworkdayjobs.com/Snyk_Careers/jobs' },
    { name: 'Checkmarx', url: 'https://checkmarx.wd5.myworkdayjobs.com/Checkmarx_Careers/jobs' },
    { name: 'Veracode', url: 'https://veracode.wd5.myworkdayjobs.com/Veracode_Careers/jobs' },
    { name: 'Trellix', url: 'https://trellix.wd5.myworkdayjobs.com/Trellix_Careers/jobs' },
    { name: 'Mandiant', url: 'https://mandiant.wd5.myworkdayjobs.com/Mandiant_Careers/jobs' },
    { name: 'FireEye', url: 'https://fireeye.wd5.myworkdayjobs.com/FireEye_Careers/jobs' },
    { name: 'CiscoTalos', url: 'https://ciscotalos.wd5.myworkdayjobs.com/CiscoTalos_Careers/jobs' },
    // EdTech
    { name: 'Coursera', url: 'https://coursera.wd5.myworkdayjobs.com/Coursera_Careers/jobs' },
    { name: 'Udemy', url: 'https://udemy.wd5.myworkdayjobs.com/Udemy_Careers/jobs' },
    { name: 'Udacity', url: 'https://udacity.wd5.myworkdayjobs.com/Udacity_Careers/jobs' },
    { name: 'KhanAcademy', url: 'https://khanacademy.wd5.myworkdayjobs.com/KhanAcademy_Careers/jobs' },
    { name: 'Duolingo', url: 'https://duolingo.wd5.myworkdayjobs.com/Duolingo_Careers/jobs' },
    { name: 'Quizlet', url: 'https://quizlet.wd5.myworkdayjobs.com/Quizlet_Careers/jobs' },
    { name: 'Chegg', url: 'https://chegg.wd5.myworkdayjobs.com/Chegg_Careers/jobs' },
    { name: 'Byju', url: 'https://byju.wd5.myworkdayjobs.com/Byju_Careers/jobs' },
    { name: 'Outschool', url: 'https://outschool.wd5.myworkdayjobs.com/Outschool_Careers/jobs' },
    { name: 'VarsityTutors', url: 'https://varsitytutors.wd5.myworkdayjobs.com/VarsityTutors_Careers/jobs' },
    // Productivity & Design Tools
    { name: 'Canva', url: 'https://canva.wd5.myworkdayjobs.com/Canva_Careers/jobs' },
    { name: 'Miro', url: 'https://miro.wd5.myworkdayjobs.com/Miro_Careers/jobs' },
    { name: 'Mural', url: 'https://mural.wd5.myworkdayjobs.com/Mural_Careers/jobs' },
    { name: 'Framer', url: 'https://framer.wd5.myworkdayjobs.com/Framer_Careers/jobs' },
    { name: 'Webflow', url: 'https://webflow.wd5.myworkdayjobs.com/Webflow_Careers/jobs' },
    { name: 'Squarespace', url: 'https://squarespace.wd5.myworkdayjobs.com/Squarespace_Careers/jobs' },
    { name: 'Wix', url: 'https://wix.wd5.myworkdayjobs.com/Wix_Careers/jobs' },
    { name: 'WordPress', url: 'https://wordpress.wd5.myworkdayjobs.com/WordPress_Careers/jobs' },
    { name: 'NotionPlus', url: 'https://notionplus.wd5.myworkdayjobs.com/NotionPlus_Careers/jobs' },
    // Streaming & Social
    { name: 'TikTok', url: 'https://tiktok.wd5.myworkdayjobs.com/TikTok_Careers/jobs' },
    { name: 'Snap', url: 'https://snap.wd5.myworkdayjobs.com/Snap_Careers/jobs' },
    { name: 'PinterestLabs', url: 'https://pinterestlabs.wd5.myworkdayjobs.com/PinterestLabs_Careers/jobs' },
    { name: 'RedditLabs', url: 'https://redditlabs.wd5.myworkdayjobs.com/RedditLabs_Careers/jobs' },
        { name: 'Bumble', url: 'https://bumble.wd5.myworkdayjobs.com/Bumble_Careers/jobs' },
    { name: 'Hinge', url: 'https://hinge.wd5.myworkdayjobs.com/Hinge_Careers/jobs' },
    { name: 'Tinder', url: 'https://tinder.wd5.myworkdayjobs.com/Tinder_Careers/jobs' },
    { name: 'OkCupid', url: 'https://okcupid.wd5.myworkdayjobs.com/OkCupid_Careers/jobs' },
    { name: 'Match', url: 'https://match.wd5.myworkdayjobs.com/Match_Careers/jobs' },
    // More Enterprise
    { name: 'IBM', url: 'https://ibm.wd5.myworkdayjobs.com/IBM_Careers/jobs' },
    { name: 'SAPSuccessFactors', url: 'https://sapsuccessfactors.wd5.myworkdayjobs.com/SAPSuccessFactors_Careers/jobs' },
    { name: 'OracleNetSuite', url: 'https://oraclenetsuite.wd5.myworkdayjobs.com/OracleNetSuite_Careers/jobs' },
    { name: 'VMware', url: 'https://vmware.wd5.myworkdayjobs.com/VMware_Careers/jobs' },
    { name: 'Dell', url: 'https://dell.wd5.myworkdayjobs.com/Dell_Careers/jobs' },
    { name: 'HP', url: 'https://hp.wd5.myworkdayjobs.com/HP_Careers/jobs' },
    { name: 'Lenovo', url: 'https://lenovo.wd5.myworkdayjobs.com/Lenovo_Careers/jobs' },
    { name: 'Cisco', url: 'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/jobs' },
    { name: 'Juniper', url: 'https://juniper.wd5.myworkdayjobs.com/Juniper_Careers/jobs' },
    { name: 'Arista', url: 'https://arista.wd5.myworkdayjobs.com/Arista_Careers/jobs' },
    { name: 'PaloAltoNetworks', url: 'https://paloaltonetworks.wd5.myworkdayjobs.com/PaloAltoNetworks_Careers/jobs' },
    { name: 'Citrix', url: 'https://citrix.wd5.myworkdayjobs.com/Citrix_Careers/jobs' },
    { name: 'CitrixSystems', url: 'https://citrixsystems.wd5.myworkdayjobs.com/CitrixSystems_Careers/jobs' },
    { name: 'Nutanix', url: 'https://nutanix.wd5.myworkdayjobs.com/Nutanix_Careers/jobs' },
    { name: 'PureStorage', url: 'https://purestorage.wd5.myworkdayjobs.com/PureStorage_Careers/jobs' },
    { name: 'NetApp', url: 'https://netapp.wd5.myworkdayjobs.com/NetApp_Careers/jobs' },
    { name: 'HPE', url: 'https://hpe.wd5.myworkdayjobs.com/HPE_Careers/jobs' },
    { name: 'EMC', url: 'https://emc.wd5.myworkdayjobs.com/EMC_Careers/jobs' },
    { name: 'DellEMC', url: 'https://dellemc.wd5.myworkdayjobs.com/DellEMC_Careers/jobs' },
    // Logistics & Supply Chain
    { name: 'FedEx', url: 'https://fedex.wd5.myworkdayjobs.com/FedEx_Careers/jobs' },
    { name: 'UPS', url: 'https://ups.wd5.myworkdayjobs.com/UPS_Careers/jobs' },
    { name: 'DHL', url: 'https://dhl.wd5.myworkdayjobs.com/DHL_Careers/jobs' },
    { name: 'Flexport', url: 'https://flexport.wd5.myworkdayjobs.com/Flexport_Careers/jobs' },
    { name: 'Convoy', url: 'https://convoy.wd5.myworkdayjobs.com/Convoy_Careers/jobs' },
    { name: 'Locus', url: 'https://locus.wd5.myworkdayjobs.com/Locus_Careers/jobs' },
    { name: 'Project44', url: 'https://project44.wd5.myworkdayjobs.com/Project44_Careers/jobs' },
    { name: 'FourKites', url: 'https://fourkites.wd5.myworkdayjobs.com/FourKites_Careers/jobs' },
    // More Startups / Scale-ups
    { name: 'Retool', url: 'https://retool.wd5.myworkdayjobs.com/Retool_Careers/jobs' },
    { name: 'Airtable', url: 'https://airtable.wd5.myworkdayjobs.com/Airtable_Careers/jobs' },
    { name: 'Coda', url: 'https://coda.wd5.myworkdayjobs.com/Coda_Careers/jobs' },
    { name: 'NotionApps', url: 'https://notionapps.wd5.myworkdayjobs.com/NotionApps_Careers/jobs' },
    { name: 'Cron', url: 'https://cron.wd5.myworkdayjobs.com/Cron_Careers/jobs' },
    { name: 'Calendly', url: 'https://calendly.wd5.myworkdayjobs.com/Calendly_Careers/jobs' },
    { name: 'Loom', url: 'https://loom.wd5.myworkdayjobs.com/Loom_Careers/jobs' },
    { name: 'Mux', url: 'https://mux.wd5.myworkdayjobs.com/Mux_Careers/jobs' },
    { name: 'Clerk', url: 'https://clerk.wd5.myworkdayjobs.com/Clerk_Careers/jobs' },
    { name: 'Stytch', url: 'https://stytch.wd5.myworkdayjobs.com/Stytch_Careers/jobs' },
    { name: 'WorkOS', url: 'https://workos.wd5.myworkdayjobs.com/WorkOS_Careers/jobs' },
    { name: 'Plane', url: 'https://plane.wd5.myworkdayjobs.com/Plane_Careers/jobs' },
    { name: 'Paddle', url: 'https://paddle.wd5.myworkdayjobs.com/Paddle_Careers/jobs' },
    { name: 'LemonSqueezy', url: 'https://lemonsqueezy.wd5.myworkdayjobs.com/LemonSqueezy_Careers/jobs' },
    { name: 'Pinecone', url: 'https://pinecone.wd5.myworkdayjobs.com/Pinecone_Careers/jobs' },
    { name: 'Weaviate', url: 'https://weaviate.wd5.myworkdayjobs.com/Weaviate_Careers/jobs' },
    { name: 'Qdrant', url: 'https://qdrant.wd5.myworkdayjobs.com/Qdrant_Careers/jobs' },
    { name: 'Milvus', url: 'https://milvus.wd5.myworkdayjobs.com/Milvus_Careers/jobs' },
    { name: 'Chroma', url: 'https://chroma.wd5.myworkdayjobs.com/Chroma_Careers/jobs' },
    { name: 'Lance', url: 'https://lance.wd5.myworkdayjobs.com/Lance_Careers/jobs' },
    { name: 'DuckDB', url: 'https://duckdb.wd5.myworkdayjobs.com/DuckDB_Careers/jobs' },
    { name: 'MotherDuck', url: 'https://motherduck.wd5.myworkdayjobs.com/MotherDuck_Careers/jobs' },
    { name: 'ClickHouse', url: 'https://clickhouse.wd5.myworkdayjobs.com/ClickHouse_Careers/jobs' },
    { name: 'StarRocks', url: 'https://starrocks.wd5.myworkdayjobs.com/StarRocks_Careers/jobs' },
    { name: 'RisingWave', url: 'https://risingwave.wd5.myworkdayjobs.com/RisingWave_Careers/jobs' },
    { name: 'Materialize', url: 'https://materialize.wd5.myworkdayjobs.com/Materialize_Careers/jobs' },
    { name: 'Estuary', url: 'https://estuary.wd5.myworkdayjobs.com/Estuary_Careers/jobs' },
    { name: 'Meroxa', url: 'https://meroxa.wd5.myworkdayjobs.com/Meroxa_Careers/jobs' },
    { name: 'Decodable', url: 'https://decodable.wd5.myworkdayjobs.com/Decodable_Careers/jobs' },
    { name: 'Conduit', url: 'https://conduit.wd5.myworkdayjobs.com/Conduit_Careers/jobs' },
    { name: 'Redpanda', url: 'https://redpanda.wd5.myworkdayjobs.com/Redpanda_Careers/jobs' },
    { name: 'Warpspeed', url: 'https://warpspeed.wd5.myworkdayjobs.com/Warpspeed_Careers/jobs' },
    { name: 'Encore', url: 'https://encore.wd5.myworkdayjobs.com/Encore_Careers/jobs' },
    { name: 'Supabase', url: 'https://supabase.wd5.myworkdayjobs.com/Supabase_Careers/jobs' },
    { name: 'PlanetScale', url: 'https://planetscale.wd5.myworkdayjobs.com/PlanetScale_Careers/jobs' },
    { name: 'Neon', url: 'https://neon.wd5.myworkdayjobs.com/Neon_Careers/jobs' },
    { name: 'Turso', url: 'https://turso.wd5.myworkdayjobs.com/Turso_Careers/jobs' },
    { name: 'Upstash', url: 'https://upstash.wd5.myworkdayjobs.com/Upstash_Careers/jobs' },
    { name: 'Unkey', url: 'https://unkey.wd5.myworkdayjobs.com/Unkey_Careers/jobs' },
    { name: 'Tinybird', url: 'https://tinybird.wd5.myworkdayjobs.com/Tinybird_Careers/jobs' },
    { name: 'Turbine', url: 'https://turbine.wd5.myworkdayjobs.com/Turbine_Careers/jobs' },
    { name: 'Convex', url: 'https://convex.wd5.myworkdayjobs.com/Convex_Careers/jobs' },
    { name: 'EdgeDB', url: 'https://edgedb.wd5.myworkdayjobs.com/EdgeDB_Careers/jobs' },
    { name: 'Prisma', url: 'https://prisma.wd5.myworkdayjobs.com/Prisma_Careers/jobs' },
    { name: 'Drizzle', url: 'https://drizzle.wd5.myworkdayjobs.com/Drizzle_Careers/jobs' },
    { name: 'Kysely', url: 'https://kysely.wd5.myworkdayjobs.com/Kysely_Careers/jobs' },
    { name: 'Deno', url: 'https://deno.wd5.myworkdayjobs.com/Deno_Careers/jobs' },
    { name: 'Bun', url: 'https://bun.wd5.myworkdayjobs.com/Bun_Careers/jobs' },
    { name: 'Astro', url: 'https://astro.wd5.myworkdayjobs.com/Astro_Careers/jobs' },
    { name: 'Svelte', url: 'https://svelte.wd5.myworkdayjobs.com/Svelte_Careers/jobs' },
    { name: 'SolidJS', url: 'https://solidjs.wd5.myworkdayjobs.com/SolidJS_Careers/jobs' },
    { name: 'Qwik', url: 'https://qwik.wd5.myworkdayjobs.com/Qwik_Careers/jobs' },
    { name: 'Remix', url: 'https://remix.wd5.myworkdayjobs.com/Remix_Careers/jobs' },
    { name: 'Gatsby', url: 'https://gatsby.wd5.myworkdayjobs.com/Gatsby_Careers/jobs' },
    { name: 'Nuxt', url: 'https://nuxt.wd5.myworkdayjobs.com/Nuxt_Careers/jobs' },
    { name: 'Vite', url: 'https://vite.wd5.myworkdayjobs.com/Vite_Careers/jobs' },
    { name: 'Vitest', url: 'https://vitest.wd5.myworkdayjobs.com/Vitest_Careers/jobs' },
    { name: 'Playwright', url: 'https://playwright.wd5.myworkdayjobs.com/Playwright_Careers/jobs' },
    { name: 'Cypress', url: 'https://cypress.wd5.myworkdayjobs.com/Cypress_Careers/jobs' },
    { name: 'TestingLibrary', url: 'https://testinglibrary.wd5.myworkdayjobs.com/TestingLibrary_Careers/jobs' },
    { name: 'Storybook', url: 'https://storybook.wd5.myworkdayjobs.com/Storybook_Careers/jobs' },
    { name: 'Turborepo', url: 'https://turborepo.wd5.myworkdayjobs.com/Turborepo_Careers/jobs' },
    { name: 'Nx', url: 'https://nx.wd5.myworkdayjobs.com/Nx_Careers/jobs' },
    { name: 'Lerna', url: 'https://lerna.wd5.myworkdayjobs.com/Lerna_Careers/jobs' },
    { name: 'Changesets', url: 'https://changesets.wd5.myworkdayjobs.com/Changesets_Careers/jobs' },
    { name: 'Release', url: 'https://release.wd5.myworkdayjobs.com/Release_Careers/jobs' },
    { name: 'Ship', url: 'https://ship.wd5.myworkdayjobs.com/Ship_Careers/jobs' },
    { name: 'Deploy', url: 'https://deploy.wd5.myworkdayjobs.com/Deploy_Careers/jobs' },
    { name: 'CI', url: 'https://ci.wd5.myworkdayjobs.com/CI_Careers/jobs' },
    { name: 'CD', url: 'https://cd.wd5.myworkdayjobs.com/CD_Careers/jobs' },
    { name: 'DevOps', url: 'https://devops.wd5.myworkdayjobs.com/DevOps_Careers/jobs' },
    { name: 'SRE', url: 'https://sre.wd5.myworkdayjobs.com/SRE_Careers/jobs' },
    { name: 'Platform', url: 'https://platform.wd5.myworkdayjobs.com/Platform_Careers/jobs' },
    { name: 'Infra', url: 'https://infra.wd5.myworkdayjobs.com/Infra_Careers/jobs' },
    { name: 'Cloud', url: 'https://cloud.wd5.myworkdayjobs.com/Cloud_Careers/jobs' },
    { name: 'Kubernetes', url: 'https://kubernetes.wd5.myworkdayjobs.com/Kubernetes_Careers/jobs' },
    { name: 'Docker', url: 'https://docker.wd5.myworkdayjobs.com/Docker_Careers/jobs' },
    { name: 'Terraform', url: 'https://terraform.wd5.myworkdayjobs.com/Terraform_Careers/jobs' },
    { name: 'Ansible', url: 'https://ansible.wd5.myworkdayjobs.com/Ansible_Careers/jobs' },
    { name: 'Pulumi', url: 'https://pulumi.wd5.myworkdayjobs.com/Pulumi_Careers/jobs' },
    { name: 'Helm', url: 'https://helm.wd5.myworkdayjobs.com/Helm_Careers/jobs' },
    { name: 'ArgoCD', url: 'https://argocd.wd5.myworkdayjobs.com/ArgoCD_Careers/jobs' },
    { name: 'Flux', url: 'https://flux.wd5.myworkdayjobs.com/Flux_Careers/jobs' },
    { name: 'Istio', url: 'https://istio.wd5.myworkdayjobs.com/Istio_Careers/jobs' },
    { name: 'Linkerd', url: 'https://linkerd.wd5.myworkdayjobs.com/Linkerd_Careers/jobs' },
    { name: 'Envoy', url: 'https://envoy.wd5.myworkdayjobs.com/Envoy_Careers/jobs' },
    { name: 'Cilium', url: 'https://cilium.wd5.myworkdayjobs.com/Cilium_Careers/jobs' },
    { name: 'Calico', url: 'https://calico.wd5.myworkdayjobs.com/Calico_Careers/jobs' },
    { name: 'Falco', url: 'https://falco.wd5.myworkdayjobs.com/Falco_Careers/jobs' },
    { name: 'Trivy', url: 'https://trivy.wd5.myworkdayjobs.com/Trivy_Careers/jobs' },
    { name: 'Grype', url: 'https://grype.wd5.myworkdayjobs.com/Grype_Careers/jobs' },
    { name: 'Syft', url: 'https://syft.wd5.myworkdayjobs.com/Syft_Careers/jobs' },
    { name: 'Cosign', url: 'https://cosign.wd5.myworkdayjobs.com/Cosign_Careers/jobs' },
    { name: 'Notary', url: 'https://notary.wd5.myworkdayjobs.com/Notary_Careers/jobs' },
    { name: 'Sigstore', url: 'https://sigstore.wd5.myworkdayjobs.com/Sigstore_Careers/jobs' },
    { name: 'InToto', url: 'https://intoto.wd5.myworkdayjobs.com/InToto_Careers/jobs' },
    { name: 'SLSA', url: 'https://slsa.wd5.myworkdayjobs.com/SLSA_Careers/jobs' },
    { name: 'Tekton', url: 'https://tekton.wd5.myworkdayjobs.com/Tekton_Careers/jobs' },
    { name: 'Knative', url: 'https://knative.wd5.myworkdayjobs.com/Knative_Careers/jobs' },
    { name: 'OpenFunction', url: 'https://openfunction.wd5.myworkdayjobs.com/OpenFunction_Careers/jobs' },
    { name: 'Dapr', url: 'https://dapr.wd5.myworkdayjobs.com/Dapr_Careers/jobs' },
    { name: 'KEDA', url: 'https://keda.wd5.myworkdayjobs.com/KEDA_Careers/jobs' },
    { name: 'Keptn', url: 'https://keptn.wd5.myworkdayjobs.com/Keptn_Careers/jobs' },
    { name: 'Backstage', url: 'https://backstage.wd5.myworkdayjobs.com/Backstage_Careers/jobs' },
    { name: 'Port', url: 'https://port.wd5.myworkdayjobs.com/Port_Careers/jobs' },
    { name: 'Cortex', url: 'https://cortex.wd5.myworkdayjobs.com/Cortex_Careers/jobs' },
    { name: 'OpsLevel', url: 'https://opslevel.wd5.myworkdayjobs.com/OpsLevel_Careers/jobs' },
    { name: 'Compass', url: 'https://compass.wd5.myworkdayjobs.com/Compass_Careers/jobs' },
    { name: 'SpotifyBackstage', url: 'https://spotifybackstage.wd5.myworkdayjobs.com/SpotifyBackstage_Careers/jobs' },
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
          'User-Agent': 'Prose AI Bot',
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