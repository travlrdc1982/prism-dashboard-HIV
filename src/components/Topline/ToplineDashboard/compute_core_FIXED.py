"""
PRISM Topline — core compute module.

This file contains the STUDY configuration and the build_topline(df) function.
It can be called from two entry points:

  (1) Standalone CLI:    compute.py reads a .sav file via pyreadstat,
                         then calls build_topline(df).
  (2) Inside SPSS:       an .sps syntax file reads the active dataset
                         via spssdata, then calls build_topline(df).

In both cases, `df` must be a pandas DataFrame with:
  - One column per SPSS variable (exact name and case)
  - Including XSEG_ASSIGNED (numeric 1-16, canonical PRISM segments)
  - All variables referenced in ITEMS / PRE_POST registries
  - Optionally a weight variable (assigned to df['WGT'] before build_topline runs;
    if absent, build_topline assigns WGT = 1.0)
"""
import pandas as pd
import json
from collections import OrderedDict
from math import sqrt
from pathlib import Path

# ═════════════════════════════════════════════════════════════════════
# STUDY CONFIG — the only block that changes per study
# ═════════════════════════════════════════════════════════════════════

STUDY = {
    'id':              'PRISM_HIV_2026',
    'title':           'PRISM HIV Treatment & Prevention',
    'subtitle':        'PRISM Voter Study — RCG / Dynata',
    'field_dates':     'TBD',                                  # computed from `date` var at build time
    'version':         'v1.0',
    'analyst':         'Bryan Dumont',
    'rendered':        '2026-05-15',
    'weighted':        True,
    'weight_target':   'Rake weights — Census parameters (age × sex × race/ethnicity × education × region) × 2024 vote',
    'weight_note':     'Production rake weights applied (WGT). Weighted n equals sample n.',
    'validity_note':   'All n=1,044 included. Validity flags pending review.',
    'nav_brand':       'PRISM',
    'nav_study_label': 'HIV Treatment & Prevention',
    'coalition_a_label':   'GOP Coalition',
    'coalition_b_label':   'DEM Coalition',
    'party_band_a_label':  'GOP COALITION',
    'party_band_b_label':  'DEM COALITION',
}

# ─────────────────────────────────────────────────────────
# METHODOLOGY LABELS — strings that describe the statistical
# methods used in the dashboard (popovers, legend, toggles).
#
# These are NOT per-study content. They describe HOW the stats
# are computed and should stay consistent across all PRISM
# toplines for credibility. Edit them only when the underlying
# methodology changes (e.g., switching to a different test).
#
# Placeholders: {gain} and {loss} in pop_paired_switchers are
# substituted at render time with the actual switcher counts.
# ─────────────────────────────────────────────────────────
LABELS = {
    # Popover field labels (per-row data inside tooltips)
    'pop_top3':          'Top-3 (5-7)',
    'pop_bot3':          'Bot-3 (1-3)',
    'pop_mean':          'Mean',
    'pop_n':             'n',
    'pop_net':           'NET',
    'pop_delta_top3':    'Δ Top-3',
    'pop_delta_mean':    'Δ Mean',
    'pop_n_paired':      'n (paired)',

    # Popover methodology block titles & subtitles
    'pop_paired_title':       'Paired test (McNemar)',
    'pop_paired_no_discord':  'no discordant pairs',
    'pop_paired_switchers':   '{gain} respondents gained top-3 · {loss} lost top-3',
    'pop_dvr_title':          'Δ vs. rest of sample',
    'pop_dvr_subtitle':       'Differential persuadability',
    'method_mcnemar_chi2':    'McNemar (continuity corrected)',
    'method_mcnemar_exact':   'Exact McNemar (binomial)',
    'method_no_discord':      'no discordant pairs',

    # Sig phrasing — PRE/POST row z-test (vs. rest of sample)
    'sig_zr_ns':  'not sig vs. rest of sample',
    'sig_zr_05':  'sig at p<.05 vs. rest of sample',
    'sig_zr_01':  'sig at p<.01 vs. rest of sample',

    # Sig phrasing — Δ row McNemar (3-tier)
    'sig_d_ns':   'not sig',
    'sig_d_10':   'sig at p<.10',
    'sig_d_05':   'sig at p<.05',
    'sig_d_01':   'sig at p<.01',

    # Sig phrasing — Δ-vs-rest (3-tier compact)
    'sig_dvr_ns': 'n.s.',
    'sig_dvr_10': 'p<.10',
    'sig_dvr_05': 'p<.05',
    'sig_dvr_01': 'p<.01',

    # Toggle bar
    'toggle_show_mb3':  'Show mean and bottom-box under each cell',
    'toggle_show_dist': 'Show full frequency distribution under each cell',
    'toggle_info':      'Click any cell for popover · z-test vs. rest of sample',

    # Legend strip (above each banner-table module)
    'legend_shading_title': 'Shading (top-3 vs. Total):',
    'legend_shading_arrow': 'pp below ← Total → pp above',
    'legend_sig_zr_title':  'Sig — PRE/POST row (vs. rest):',
    'legend_sig_d_title':   'Sig — Δ row (paired):',
    'legend_p10':           'p<.10',
    'legend_p05':           'p<.05',
    'legend_p01':           'p<.01',
}

# Modules — top nav, landing tiles, section bars. See build guide.
MODULES = [
    # ── Module 01: HIV Stigma ──────────────────────────────────────
    {
        'id': 'stigma', 'active': True, 'item_type': 'items',
        'nav_label':     'HIV Stigma',
        'tile_num':      '01',
        'tile_title':    'HIV Stigma',
        'tile_desc':     'HIV stigma · MFQ · knowledge · composites',
        'section_title': 'HIV Stigma',
        'section_meta':  'HIV stigma items, Moral Foundations, HIV knowledge, and composites (MBS, SDS, EDS, SCS, CFS, PFS, SCF, HKS)',
        'section_intro': 'Three batteries plus a composites block. <strong>HIV Stigma</strong>: 13 items (7-pt agree-disagree). <strong>MFQ</strong>: 8 items (7-pt relevance). <strong>HIV Knowledge</strong>: 11 items, % aware — item 5 ("epidemic effectively over") is the false statement. <strong>Composites</strong>: MBS, SDS, EDS, SCS from HIV Stigma items; CFS, PFS, SCF from MFQ items; HKS from knowledge items (excluding K5).',
        'show_legend':   False,
        'show_toggles':  False,
    },
    # ── Module 02: Pre-Post Outcome Metrics ────────────────────────
    {
        'id': 'prepost', 'active': True, 'item_type': 'pre_post',
        'nav_label':     'Pre / Post',
        'tile_num':      '02',
        'tile_title':    'Pre-Post Outcome Metrics',
        'tile_desc':     '7 items × Total + 16 segments × PRE/POST/Δ',
        'section_title': 'Pre-Post Outcome Metrics',
        'section_meta':  'Movement on key health and policy items, before vs. after message exposure',
        'section_intro': 'Each item appears twice: <strong>PRE</strong> (before exposure), <strong>POST</strong> (after). Δ = POST − PRE. Cells show <strong>Top-3 Box %</strong>. Three panes per item: the question as the respondent saw it (Fraunces) · codebook (vars, scale, recodes, composites) · banner table.',
        'show_legend':   True,
        'show_toggles':  True,
    },
    # ── Module 03: ROI Scorecard ───────────────────────────────────
    {
        'id': 'roi', 'active': True, 'item_type': 'roi',
        'nav_label':     'ROI',
        'tile_num':      '03',
        'tile_title':    'ROI Scorecard',
        'tile_desc':     '16-segment ROI infographic · Coalition × Persuasion × Activation × Influence',
        'section_title': 'ROI Scorecard',
        'section_meta':  'Per-segment ROI score, coalition support, persuasion, activation, and influence',
        'section_intro': 'Per-segment ROI rendered as a vector infographic. ROI is normalized: <strong>segment mean efROI ÷ total mean efROI</strong>. Values ≥ 1.0 appear in pills; below 1.0 grey without pill. Coalition Support = top-2 box of XCOALITION (Champions + Supporters). Persuasion = sign of XALIGN_MOVEr1. Activation = mean XROIr5 (mobilization probability). Influence³⁶⁰ = mean BCS (XSMr4). All computation aside from the ROI ratio is done in SPSS.',
        'show_legend':   False,
        'show_toggles':  False,
    },
    # ── Module 04: Critics Messages ────────────────────────────────
    {
        'id': 'critics', 'active': True, 'item_type': 'items',
        'nav_label':     'Critics',
        'tile_num':      '04',
        'tile_title':    'Critics Messages',
        'tile_desc':     '11 counter-argument items · Top-3 by segment',
        'section_title': 'Critics Messages',
        'section_meta':  'Counter-arguments and oppositional frames respondents may have encountered',
        'section_intro': '<strong>Top-3 Box %</strong> agreeing with each oppositional statement, by segment. Sig markers indicate significance vs. rest of sample at p&lt;.05 (•) or p&lt;.01 (••). Higher = more receptive to the critique.',
        'show_legend':   False,
        'show_toggles':  False,
    },
    # ── Module 05: Message Testing (formerly MaxDiff B-W) ──────────
    {'id': 'maxdiff', 'active': False, 'nav_label': 'Message Testing', 'tile_num': '05',
     'tile_title': 'Message Testing', 'tile_desc': '16 messages × MaxDiff utilities (tabular)'},
    # ── Module 06: Trusted Sources ─────────────────────────────────
    {'id': 'sources', 'active': False, 'nav_label': 'Trusted Sources', 'tile_num': '06',
     'tile_title': 'Trusted Sources', 'tile_desc': '23 sources × split-sample blocked k=9'},
    # ── Module 07: Demographics ────────────────────────────────────
    {
        'id': 'demos', 'active': True, 'item_type': 'demographics',
        'nav_label':     'Demographics',
        'tile_num':      '07',
        'tile_title':    'Demographics',
        'tile_desc':     '11 questions · per-segment frequency distribution',
        'section_title': 'Demographics',
        'section_meta':  'Gender, age, race/ethnicity, region, RUCA, education, veteran, union, religion, income, personal contact',
        'section_intro': 'Each question renders as a multi-row block: one row per response option. Cells show <strong>% of segment selecting that option</strong>. Hover for n and weighted percent. Continuous QAGE mean/median shown in the age question popover.',
        'show_legend':   False,
        'show_toggles':  False,
    },
    # ── Module 08: Influencer360 ───────────────────────────────────
    {
        'id': 'influencer', 'active': True, 'item_type': 'influencer',
        'nav_label':     'Influencer360',
        'tile_num':      '08',
        'tile_title':    'Influencer360',
        'tile_desc':     '14 behaviors + 3 actions + social-media + composites',
        'section_title': 'Influencer360',
        'section_meta':  'Behavioral influence profile by segment — L1 / L2 / L3 / BCS composites',
        'section_intro': 'Single-row banner per item showing <strong>% Yes</strong> in each segment for binary behaviors, <strong>% any activity</strong> for the social-media frequency items (excludes "Never"). Items grouped into four sub-blocks: high-engagement (L2/L3), low-engagement (L1), social-media advocacy, and audience reach (categorical distribution). Composites L1 / L2 / L3 / BCS rendered at the top.',
        'show_legend':   False,
        'show_toggles':  False,
    },
]

# Canonical PRISM 16-segment frame. Order and codes match SPSS XSEG_ASSIGNED.
SEGMENTS = [
    (1, 'TSP', 'Trust-the-Science Pragmatists',     'GOP'),
    (2, 'CEC', 'Consumer Empowerment Champions',    'GOP'),
    (3, 'TC',  'Traditional Conservatives',         'GOP'),
    (4, 'HF',  'Health Futurist',                   'GOP'),
    (5, 'PP',  'Price Populists',                   'GOP'),
    (6, 'WE',  'Wellness Evangelists',              'GOP'),
    (7, 'PFF', 'Paleo Freedom Fighters',            'GOP'),
    (8, 'HHN', 'Holistic Health Naturalists',       'GOP'),
    (9, 'MFL', 'Medical Freedom Libertarians',      'GOP'),
    (10,'VS',  'Vaccine Skeptics',                  'GOP'),
    (11,'UCP', 'Universal Care Progressives',       'DEM'),
    (12,'FJP', 'Faith & Justice Progressives',      'DEM'),
    (13,'HCP', 'Health Care Protectionists',        'DEM'),
    (14,'HAD', 'Health Abundance Democrats',        'DEM'),
    (15,'HCI', 'Health Care Incrementalists',       'DEM'),
    (16,'GHI', 'Global Health Institutionalists',   'DEM'),
]

# ═════════════════════════════════════════════════════════════════════
# BATTERIES — shared defaults for multi-item batteries (Critics, Stigma,
# Trusted Sources, etc.). Define the boilerplate once per battery; each
# item entry then only needs the fields that actually differ.
#
# Each item that references a battery via 'battery': '<name>' inherits:
#   - section, scale, scale_anchors, metric_label_scale
#   - all survey.* fields (anchor labels, style, intro, stem)
#   - all codebook.* fields (scale_type, filter, block, recode, etc.)
# Plus three auto-generated conveniences:
#   - survey.intro only appears on the FIRST item in the battery
#   - survey.progress auto-fills as "{position} of {total} statements"
#   - survey.text auto-fills from the item's 'wording' field
#   - codebook.var auto-fills from the item's 'id' (SPSS variable name)
#
# Override any inherited field by setting it explicitly on the item.
# ═════════════════════════════════════════════════════════════════════
BATTERIES = {
    'critics': {
        'section': 'critics',
        'total': 11,                    # total items in the survey-side battery
        'scale': 7,
        'scale_anchors': ['Strongly DISAGREE','Neither / Neutral','Strongly AGREE'],
        'survey': {
            'style': 'CARDSHUFFLE',
            'intro': "You'll now see a handful of statements drawn from people who see this issue from a variety of perspectives. We're interested in your honest reaction to how these arguments land with you.",
            'stem': 'For each statement, indicate how much you agree or disagree…',
            'anchor_left': 'Strongly\nDisagree',
            'anchor_center': 'Neutral /\nUnsure',
            'anchor_right': 'Strongly\nAgree',
        },
        'codebook': {
            'scale_type': '7-pt Likert (agree-disagree)',
            'filter': 'All respondents (n=957 valid)',
            'block': 'Critics Messages (randomized order, k=11 items)',
            'recode': 'None',
            'design_note': 'Order of critic messages rotated before and after outcome pre-test measures.',
        },
        'metric_label_scale': 'Top-3 Box (5-7) of 7-pt agree-disagree scale',
    },
    'hivstigma': {
        'section': 'stigma',
        'total': 13,
        'scale': 7,
        'scale_anchors': ['Strongly DISAGREE','Neither / Neutral','Strongly AGREE'],
        'survey': {
            'style': 'CARDSHUFFLE',
            'intro': "People hold many different views on the following issues. Please tell us how much you agree or disagree with each statement. There are no right or wrong answers.",
            'stem': 'For each statement, indicate how much you agree or disagree…',
            'anchor_left': 'Strongly\nDisagree',
            'anchor_center': 'Neutral /\nUnsure',
            'anchor_right': 'Strongly\nAgree',
        },
        'codebook': {
            'scale_type': '7-pt Likert (agree-disagree)',
            'filter': 'Designed split sample · n=833 valid of 1,044 total',
            'block': 'HIV Stigma battery (randomized order, k=13 items)',
            'recode': 'None',
            'design_note': 'Battery on a designed split sample (LOI-reduction allocation): ~80% of respondents received these items. Sig markers compare each segment against the rest of the valid sample within this battery.',
        },
        'metric_label_scale': 'Top-3 Box (5-7) of 7-pt agree-disagree scale',
    },
    'mfq': {
        'section': 'stigma',
        'total': 8,
        'scale': 7,
        'scale_anchors': ['Not at all RELEVANT','Neither / Neutral','Extremely RELEVANT'],
        'survey': {
            'style': 'CARDSHUFFLE',
            'intro': "Now consider a different set of moral concerns. For each item below, please indicate how relevant it is to how you make moral judgments, from 1 ('Not at all relevant') to 7 ('Extremely relevant').",
            'stem': 'How relevant is this consideration to how you make moral judgments?',
            'anchor_left': 'Not at all\nrelevant',
            'anchor_center': 'Neutral',
            'anchor_right': 'Extremely\nrelevant',
        },
        'codebook': {
            'scale_type': '7-pt relevance scale (1 = not at all, 7 = extremely)',
            'filter': 'Designed split sample · n=829 valid of 1,044 total',
            'block': 'Moral Foundations Questionnaire (randomized order, k=8 items)',
            'recode': 'None',
            'citation': 'Graham J, Haidt J, Nosek BA (2009). Liberals and conservatives rely on different sets of moral foundations. J Pers Soc Psychol, 96(5), 1029–46.',
            'design_note': 'Abbreviated MFQ on a designed split sample (LOI-reduction allocation): ~80% of respondents received these items. Care (r1, r2), Purity (r3, r4), Fairness (r5), Liberty (r6), Loyalty (r7), Authority (r8). Care/Purity items feed CFS, PFS, SCF composites.',
        },
        'metric_label_scale': 'Top-3 Box (5-7) of 7-pt relevance scale',
    },
}

# ═════════════════════════════════════════════════════════════════════
# DEMOGRAPHICS REGISTRY
# ═════════════════════════════════════════════════════════════════════
#
# Each entry defines one demographic question. The questionnaire pane on
# the left shows the response options; the banner-table on the right
# shows the per-segment frequency distribution across those response
# options. Unlike Likert items, each question renders as a multi-row block
# (one row per response option) rather than a single-row banner.
#
# Fields per entry:
#   id:           unique identifier (also used as section anchor)
#   var:          SPSS variable to read
#   wording:      question text (shown in survey pane and codebook)
#   style:        survey-pane render style ('radio' | 'buttonselect' | 'buttongrid' | 'dropdown' | 'numeric')
#   options:      list of (value, label, [show_in_banner]) tuples
#                 show_in_banner=False suppresses the row but keeps it in the survey-pane mockup
#   recode:       optional pre-render rollup, e.g., {'collapse_to_yes': [1, 2]}
#                 used for Veteran where pane shows 3 buttons but banner shows 1 row (% Yes)
#   show_in_pane: optional list of (value, label) tuples for the survey-pane mockup
#                 if different from `options` (e.g., for the race/ethnic 2-question stack)
#   pane_extra:   optional extra content rendered above/below the main options in the pane
#                 (used for QRACE_ETHNIC stacking Hispanic question above Race)
#   pane_meta:    optional mean/median to show in popover (used for QAGE)

DEMOGRAPHICS = [
    {
        'id': 'gender',
        'var': 'QGENDER',
        'block_label': 'Demographics — Gender',
        'wording': 'Which of the following best describes your gender?',
        'style': 'radio',
        'weight_relevant': True,
        'options': [
            (1, 'Male'),
            (2, 'Female'),
            (3, 'Other'),
        ],
    },
    {
        'id': 'age',
        'var': 'QAGECAT5',
        'block_label': 'Demographics — Age',
        'wording': 'What is your age?',
        'style': 'numeric',
        'weight_relevant': True,
        'options': [
            (1, '18-29'),
            (2, '30-44'),
            (3, '45-54'),
            (4, '55-64'),
            (5, '65+'),
        ],
        'pane_meta': {'continuous_var': 'QAGE', 'show_mean_median': True, 'pane_subtitle': "Tell us how old you are. (We won't tell)"},
        'pane_extra': {'numeric_boxes': 2},
    },
    {
        'id': 'race_ethnic',
        'var': 'QRACE_ETHNIC',
        'block_label': 'Demographics — Race & Ethnicity',
        'wording': 'Race / Ethnicity (Hispanic + Race, collapsed)',
        'style': 'radio',
        'weight_relevant': True,
        'options': [
            (1, 'White (non-Hispanic)'),
            (2, 'Black (non-Hispanic)'),
            (3, 'Asian (non-Hispanic)'),
            (4, 'Other (non-Hispanic)'),
            (5, 'Hispanic'),
        ],
        'pane_extra': {
            'stacked_questions': [
                {
                    'wording': 'Are you, yourself, of Hispanic or Latino background? Such as Mexican, Puerto Rican, Cuban, or some other Spanish background.',
                    'style': 'buttonselect',
                    'options': [(1, 'Yes'), (2, 'No')],
                },
                {
                    'wording': 'Which of the following best describes your race?',
                    'style': 'radio',
                    'options': [(1, 'White'), (2, 'Black'), (3, 'Asian'), (4, 'Other')],
                },
            ],
        },
    },
    {
        'id': 'region',
        'var': 'XQREGION',
        'block_label': 'Demographics — Census Region',
        'wording': 'Census Region (derived from QZIP → XQDIVISION → XQREGION)',
        'style': 'derived',
        'weight_relevant': True,
        'derived_from': 'QZIP → XQDIVISION (9 divisions) → XQREGION (4 regions)',
        'options': [
            (1, 'Northeast'),
            (2, 'Midwest'),
            (3, 'South'),
            (4, 'West'),
        ],
        'pane_extra': {
            'derived_note': 'Census Region is computed from the respondent\'s ZIP code. Pane shows the source ZIP-entry screen.',
            'pane_shows_var': 'QZIP',
            'pane_subtitle': 'Census Region is derived from QZIP via the 9-level Census Division (XQDIVISION) and rolled up to the 4-level Census Region.',
        },
    },
    {
        'id': 'ruca',
        'var': 'XQPrimaryRUCA',
        'block_label': 'Demographics — Urban / Suburban / Rural',
        'wording': 'Rural-Urban Commuting Area (RUCA, collapsed to 5 levels)',
        'style': 'derived',
        'weight_relevant': False,
        'derived_from': 'QZIP → XQPrimaryRUCA (10-level), collapsed: Urban=1, Suburban=2-3, Exurban=4-6, Small Town Rural=7-9, Rural=10',
        'recode': {'ruca_collapse': True},
        'options': [
            ('urban',     'Urban (RUCA 1)'),
            ('suburban',  'Suburban (RUCA 2-3)'),
            ('exurban',   'Exurban (RUCA 4-6)'),
            ('smalltown', 'Small Town Rural (RUCA 7-9)'),
            ('rural',     'Rural (RUCA 10)'),
        ],
        'pane_extra': {
            'derived_note': 'RUCA is computed from the respondent\'s ZIP code. Pane shows the source ZIP-entry screen.',
            'pane_shows_var': 'QZIP',
            'pane_subtitle': 'Rural-Urban Commuting Area is derived from QZIP. 10-level primary code collapsed to 5 levels: Urban (1), Suburban (2-3), Exurban (4-6), Small Town Rural (7-9), Rural (10).',
        },
    },
    {
        'id': 'education',
        'var': 'XEDU_CAT',
        'block_label': 'Demographics — Education',
        'wording': 'Please indicate the highest level of school you completed or the highest degree you have received.',
        'style': 'buttongrid',
        'weight_relevant': False,
        'options': [
            (1, 'High school or GED'),
            (2, 'Some college, no degree'),
            (3, 'Associate\'s'),
            (4, 'Bachelor\'s'),
            (5, 'Graduate / Professional'),
        ],
        'pane_extra': {
            'options_for_pane': [
                'Did not finish high school', 'High school diploma or GED',
                'Some college credit, no degree', 'Trade / technical / vocational',
                'Associate\'s degree', 'Bachelor\'s degree',
                'Master\'s degree', 'Professional degree (JD, MD)', 'Doctorate (PhD)',
            ],
        },
    },
    {
        'id': 'vet',
        'var': 'QVET',
        'block_label': 'Demographics — Military Service',
        'wording': 'Have you ever served on active duty in the U.S. Armed Forces, Reserves, or National Guard?',
        'style': 'buttonselect',
        'weight_relevant': False,
        'options': [
            (1, 'Yes — currently serving'),
            (2, 'Yes — retired or inactive'),
            (3, 'No'),
        ],
    },
    {
        'id': 'union',
        'var': 'QUNION',
        'block_label': 'Demographics — Union Membership',
        'wording': 'Are you currently, or have you ever been, part of a labor union?',
        'style': 'buttonselect',
        'weight_relevant': False,
        'options': [
            (1, 'Yes'),
        ],
        'pane_extra': {
            'options_for_pane': ['Yes', 'No'],
        },
        'recode': {'show_only_yes': True},
    },
    {
        'id': 'religion',
        'var': 'QREL_CAT',
        'block_label': 'Demographics — Religion',
        'wording': 'What is your present religion, if any?',
        'style': 'dropdown',
        'weight_relevant': False,
        'options': [
            (1, 'White Evangelical'),
            (2, 'Black Protestant'),
            (3, 'White Mainline Protestant'),
            (4, 'Catholic'),
            (5, 'Jewish'),
            (6, 'Other'),
            (7, 'None / Unaffiliated'),
        ],
        'pane_extra': {
            'options_for_pane': [
                'Protestant', 'Roman Catholic', 'LDS/Mormon', 'Orthodox',
                'Jewish', 'Muslim', 'Buddhist', 'Hindu', 'Atheist', 'Agnostic',
                'Something else', 'Nothing in particular',
            ],
            'highlight_mode': True,
        },
    },
    {
        'id': 'income',
        'var': 'QD23A',
        'block_label': 'Demographics — Household Income',
        'wording': 'Last year — that is, in 2025 — what was your total family income from all sources, before taxes?',
        'style': 'dropdown',
        'weight_relevant': False,
        'options': [
            (1, 'Less than $20K'),
            (2, '$20K - $50K'),
            (3, '$50K - $100K'),
            (4, '$100K - $150K'),
            (5, '$150K or more'),
        ],
        'pane_extra': {
            'options_for_pane': [
                'Less than $10,000', '$10,000 - $19,999', '$20,000 - $29,999',
                '$30,000 - $39,999', '$40,000 - $49,999', '$50,000 - $59,999',
                '$60,000 - $69,999', '$70,000 - $79,999', '$80,000 - $89,999',
                '$90,000 - $99,999', '$100,000 - $124,999', '$125,000 - $149,999',
                '$150,000 - $199,999', '$200,000 - $499,999', '$500,000 or more',
            ],
            'highlight_mode': True,
        },
    },
    # ── Personal Contact battery (4 binary items — do you know anyone in X group) ──
    # Single block with 4 rows. Binary % Yes per item. Rows do NOT sum to 100%.
    # Includes 2 substantive items (LGB, HIV+) and 2 controls (cancer, addiction).
    {
        'id': 'contact',
        'block_label': 'Demographics — Personal Contact',
        'wording': 'The following questions ask about people you may know personally. Please answer as honestly as you can — there are no right or wrong answers, and all responses are completely confidential.',
        'style': 'binary_set',
        'weight_relevant': False,
        # No single 'var' — multi-item block
        'items': [
            {'var': 'QCON_LGBr1', 'code': 'CON_LGB',     'wording': 'Do you personally know anyone who is gay, lesbian, or bisexual?',         'category': 'substantive'},
            {'var': 'QCON_LGBr2', 'code': 'CON_HIV',     'wording': 'Do you personally know anyone who is HIV-positive or living with AIDS?', 'category': 'substantive'},
            {'var': 'QCON_LGBr3', 'code': 'CON_CANCER',  'wording': 'Do you personally know anyone who has been diagnosed with cancer?',       'category': 'control'},
            {'var': 'QCON_LGBr4', 'code': 'CON_ADDICT',  'wording': 'Do you personally know anyone who has struggled with alcohol or drug addiction?', 'category': 'control'},
        ],
        'pane_extra': {
            'pane_subtitle': '4-item binary battery. r1 and r2 are substantive (contact with LGB and HIV+ communities). r3 and r4 are matched controls (high-prevalence low-stigma condition; moderately-stigmatized condition).',
        },
    },
]


# ═════════════════════════════════════════════════════════════════════
# INFLUENCER360 REGISTRY
# ═════════════════════════════════════════════════════════════════════
#
# Multi-block module. Each entry below renders as a single-row banner
# (% Yes for binary items; "% any activity" for frequency items),
# grouped under sub-headers for visual organization.

# ═════════════════════════════════════════════════════════════════════
# INFLUENCER360 — 5 blocks, demographics-style three-pane rendering
# ═════════════════════════════════════════════════════════════════════
# Each block renders identically to a demographic question:
#   survey pane (mocking the questionnaire screen)
#   codebook pane (SOURCE, METRIC, etc.)
#   banner table (one row per item, % per segment)
#
# Block types:
#   binary_set   — multiple yes/no items shown as N rows (% Yes per segment).
#                  Rows do NOT sum to 100% (independent binaries).
#   categorical  — one variable with N response options shown as N rows
#                  (% in each bracket; rows DO sum to 100%).
#   frequency    — N frequency-scale items shown as N rows
#                  (% any activity, i.e., excludes "Never").
#   composites   — derived scores from XCOMPUTE_* / XSMr4 variables.

INFLUENCER_BLOCKS = [
    # ── Block 1: Composites (L1 / L2 / L3 / BCS) ─────────────────────────
    {
        'id': 'composites',
        'block_label': 'Influencer360 — Composites',
        'wording': 'Behavioral influence composite scores (derived, not asked)',
        'kind': 'composites',
        'pane_style': 'derived_note',
        'pane_subtitle': 'L1, L2, L3, and BCS are computed from the behavioral items below. They are not survey questions; they summarize behavioral influence into tiers and a continuous index.',
        'items': [
            {'var': 'XCOMPUTE_LOWINFr1', 'code': 'L1',  'wording': 'L1 — Low-engagement tier',
             'metric': 'pct_yes',
             'formula': 'L1 = 1 if (LOWINFr1=1) OR (LOWINFr2=1) OR (LOWINFr3=1), else 0'},
            {'var': 'XCOMPUTE_LOWINFr2', 'code': 'L2',  'wording': 'L2 — Medium-engagement tier',
             'metric': 'pct_yes',
             'formula': 'L2 = 1 if (INFLUENCER360r4=1) OR (r7=1) OR (r13=1), else 0'},
            {'var': 'XCOMPUTE_LOWINFr3', 'code': 'L3',  'wording': 'L3 — High-engagement tier',
             'metric': 'pct_yes',
             'formula': 'L3 = 1 if any of INFLUENCER360r1, r2, r3, r5, r6, r8, r9, r10, r11, r12, r14 = 1'},
            {'var': 'XSMr4', 'code': 'BCS', 'wording': 'BCS — Behavioral Coalition Score (continuous)',
             'metric': 'mean',
             'formula': 'BCS = composite influence index (0–1) derived from QSMr1-r3 + tier indicators'},
        ],
    },

    # ── Block 2: High-engagement behaviors (14 binary items) ─────────────
    {
        'id': 'highengagement',
        'block_label': 'Influencer360 — High-Engagement Behaviors (lifetime)',
        'wording': 'How have you made your voice heard? (select all that apply)',
        'kind': 'binary_set',
        'pane_style': 'checklist',
        'pane_subtitle': 'Independent yes/no items; respondents may endorse multiple. Cells show % indicating each behavior.',
        'metric': 'pct_yes',
        'yes_value': 1,
        'items': [
            {'var': 'INFLUENCER360r1',  'code': 'INF_1',  'wording': 'Held elected office',                                                                                  'tier': 'L3'},
            {'var': 'INFLUENCER360r2',  'code': 'INF_2',  'wording': 'Been a paid staffer or advisor to an elected official or gov\'t agency',                                'tier': 'L3'},
            {'var': 'INFLUENCER360r3',  'code': 'INF_3',  'wording': 'Held an elected or appointed role in a party committee',                                                'tier': 'L3'},
            {'var': 'INFLUENCER360r4',  'code': 'INF_4',  'wording': 'Contacted an elected official or their staff',                                                          'tier': 'L2'},
            {'var': 'INFLUENCER360r5',  'code': 'INF_5',  'wording': 'Helped recruit a candidate to run for public office',                                                    'tier': 'L3'},
            {'var': 'INFLUENCER360r6',  'code': 'INF_6',  'wording': 'Helped recruit staff for a political campaign or office',                                                'tier': 'L3'},
            {'var': 'INFLUENCER360r7',  'code': 'INF_7',  'wording': 'Met with congressional, agency, or state legislative staff',                                             'tier': 'L2'},
            {'var': 'INFLUENCER360r8',  'code': 'INF_8',  'wording': 'Sat on the board or executive committee of a health, policy, or business association',                   'tier': 'L3'},
            {'var': 'INFLUENCER360r9',  'code': 'INF_9',  'wording': 'Worked with or advised a Washington-based organization (think tank, patient advocacy, trade association)','tier': 'L3'},
            {'var': 'INFLUENCER360r10', 'code': 'INF_10', 'wording': 'Testified or submitted written comments to a legislative or Congressional committee',                    'tier': 'L3'},
            {'var': 'INFLUENCER360r11', 'code': 'INF_11', 'wording': 'Spoke at a public meeting, podcast, webinar, church or civic group on a health topic',                   'tier': 'L3'},
            {'var': 'INFLUENCER360r12', 'code': 'INF_12', 'wording': 'Wrote an article, blog post, Substack, or op-ed on an issue',                                            'tier': 'L3'},
            {'var': 'INFLUENCER360r13', 'code': 'INF_13', 'wording': 'Volunteered on a political campaign',                                                                    'tier': 'L2'},
            {'var': 'INFLUENCER360r14', 'code': 'INF_14', 'wording': 'Organized an event or rally on any issue',                                                               'tier': 'L3'},
        ],
    },

    # ── Block 3: Low-engagement actions (3 binary items) ─────────────────
    {
        'id': 'lowengagement',
        'block_label': 'Influencer360 — Low-Engagement Actions (past 12 months)',
        'wording': 'In the past 12 months, have you taken any of the following actions related to a public policy issue? (select all that apply)',
        'kind': 'binary_set',
        'pane_style': 'checklist',
        'pane_subtitle': 'Independent yes/no items. Cells show % indicating each action.',
        'metric': 'pct_yes',
        'yes_value': 1,
        'items': [
            {'var': 'LOWINFr1', 'code': 'L1_PETITION', 'wording': 'Signed a petition',  'tier': 'L1'},
            {'var': 'LOWINFr2', 'code': 'L1_MEETING',  'wording': 'Attended a meeting', 'tier': 'L1'},
            {'var': 'LOWINFr3', 'code': 'L1_DONATION', 'wording': 'Donated money',      'tier': 'L1'},
        ],
    },

    # ── Block 4: Total followers (6-bracket categorical) ─────────────────
    {
        'id': 'followers',
        'block_label': 'Influencer360 — Audience Reach',
        'wording': 'Across all your public social-media accounts, about how many followers or subscribers do you have in total?',
        'pane_subtitle': 'Including X/Twitter, Instagram, TikTok, Facebook pages, Substack, podcast, YouTube, etc. Cells show % in each bracket (rows sum to 100%).',
        'kind': 'categorical',
        'pane_style': 'buttonselect',
        'var': 'QTOT_FOLLOWERS',
        'options': [
            (0, 'None — no social media'),
            (1, '1 - 500'),
            (2, '500 - 1,999'),
            (3, '2,000 - 9,999'),
            (4, '10,000 - 49,999'),
            (5, '50,000 or more'),
        ],
    },

    # ── Block 5: Social-media activity (3 frequency items, past 30 days) ──
    {
        'id': 'sm_activity',
        'block_label': 'Influencer360 — Social-Media Activity (past 30 days)',
        'wording': 'How many times over the past 30 days have you done any of the following to advocate on a public policy issue?',
        'pane_subtitle': 'Across any social-media platform (Facebook, X, LinkedIn, TikTok, or others). 5-point frequency scale: Never / Not in past 30 days / 1 time / 2-4 times / 5+ times. Cells show % any activity (excludes "Never").',
        'kind': 'frequency',
        'pane_style': 'cardshuffle',
        'metric': 'any_activity',
        'never_value': 1,
        'items': [
            {'var': 'QSMr1', 'code': 'SM_SHARED',    'wording': 'Shared or reposted content'},
            {'var': 'QSMr2', 'code': 'SM_COMMENTED', 'wording': 'Commented or replied to posts'},
            {'var': 'QSMr3', 'code': 'SM_CREATED',   'wording': 'Created an original post or video'},
        ],
    },
]


# ═════════════════════════════════════════════════════════════════════
# ITEM REGISTRIES — populated per study
# ═════════════════════════════════════════════════════════════════════

ITEMS = [
    # ════════════════════════════════════════════════════════════════════
    # HIV STIGMA BATTERY (13 items)
    # Composite mapping (per v5 dashboard methodology):
    #   r1, r2   → SB items   → MBS (Moral Blame Score) = mean(r1, r2)
    #   r3, r4   → SD items   → SDS (Social Distance Score) = mean(r3, r4) [comfort items, higher = less distance]
    #   r5, r6   → EQ items   → EDS (Excessive Demands Score) = mean(r5, r6) [anti-LGBTQ]
    #   r7, r8   → SC items   → SCS (Social Comfort Score) = mean(r7, r8) [comfort items, higher = more comfort]
    #   r9-r13   = control / non-composite items (used for context, no composite mapping)
    # ════════════════════════════════════════════════════════════════════
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr1', 'code': 'HIVSTIGMA_SB_1',
     'wording': 'People who became infected with HIV through sexual behavior made choices that led to their situation.',
     'metric_label': '% AGREE — HIV: Sexual Behavior is a Choice [SB1 → MBS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr2', 'code': 'HIVSTIGMA_SB_2',
     'wording': 'When someone contracts HIV as a result of their own behavior, they bear more personal responsibility for dealing with the consequences than someone who became ill in other ways.',
     'metric_label': '% AGREE — HIV: Personal Responsibility for Behavior [SB2 → MBS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr3', 'code': 'HIVSTIGMA_SD_1',
     'wording': 'I would be comfortable working closely alongside a colleague I knew was HIV-positive.',
     'metric_label': '% AGREE — Comfort: Working with HIV+ Colleague [SD1 → SDS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr4', 'code': 'HIVSTIGMA_SD_2',
     'wording': 'I would be comfortable having a close personal friendship with someone who is living with HIV.',
     'metric_label': '% AGREE — Comfort: Close Friendship with HIV+ Person [SD2 → SDS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr5', 'code': 'HIVSTIGMA_EQ_1',
     'wording': 'Gay and lesbian people have been pushing harder for rights and recognition than is really necessary.',
     'metric_label': '% AGREE — Anti-LGBTQ: Pushed Too Hard [EQ1 → EDS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr6', 'code': 'HIVSTIGMA_EQ_2',
     'wording': 'The amount of attention given to the concerns of gay and lesbian people in public life has gone beyond what the situation actually calls for.',
     'metric_label': '% AGREE — Anti-LGBTQ: Excessive Attention [EQ2 → EDS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr7', 'code': 'HIVSTIGMA_SC_1',
     'wording': 'I would be comfortable living in a neighborhood where gay or lesbian couples were among my neighbors.',
     'metric_label': '% AGREE — Comfort: LGBTQ Neighbors [SC1 → SCS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr8', 'code': 'HIVSTIGMA_SC_2',
     'wording': 'In most everyday social situations, I am comfortable around people who are gay or lesbian.',
     'metric_label': '% AGREE — Comfort: Around LGBTQ Persons [SC2 → SCS]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr9', 'code': 'HIVSTIGMA_CTRL_1',
     'wording': 'People who face discrimination based on their religious beliefs or political views deserve the same legal protections as other groups.',
     'metric_label': '% AGREE — Religious / Political Discrimination Deserve Protection [CTRL]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr10', 'code': 'HIVSTIGMA_CTRL_2',
     'wording': 'In recent years, some groups have received more attention and sympathy in public life than is really warranted.',
     'metric_label': '% AGREE — Some Groups Get Unwarranted Attention [CTRL]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr11', 'code': 'HIVSTIGMA_CTRL_3',
     'wording': 'People who develop Type 2 diabetes as a result of poor diet and lack of exercise are largely responsible for their own condition.',
     'metric_label': '% AGREE — Diabetes Self-Responsibility (parallel SB test) [CTRL]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr12', 'code': 'HIVSTIGMA_CTRL_4',
     'wording': 'People who struggle with alcohol or drug addiction deserve the same compassion as people with other medical conditions.',
     'metric_label': '% AGREE — Addiction Deserves Compassion (parallel SD test) [CTRL]'},
    {'battery': 'hivstigma', 'id': 'QHIVSTIGMAr13', 'code': 'HIVSTIGMA_CTRL_5',
     'wording': 'I would feel comfortable working alongside a colleague I knew had been treated for depression or anxiety.',
     'metric_label': '% AGREE — Comfort: Mental Health Colleague (parallel SD test) [CTRL]'},

    # ════════════════════════════════════════════════════════════════════
    # MORAL FOUNDATIONS QUESTIONNAIRE (8 items, 7-pt relevance scale)
    # Composite mapping:
    #   r1, r2   → Care items   → CFS (Care Foundations Score) = mean(r1, r2)
    #   r3, r4   → Purity items → PFS (Purity Foundations Score) = mean(r3, r4)
    #   r5       → Fairness     [not in composites]
    #   r6       → Liberty      [not in composites]
    #   r7       → Loyalty      [not in composites]
    #   r8       → Authority    [not in composites]
    #   SCF (Sanctity-Care Foundation) = PFS − CFS  (positive = purity-leaning)
    # ════════════════════════════════════════════════════════════════════
    {'battery': 'mfq', 'id': 'QMFQr1', 'code': 'MFQ_CARE_1',
     'wording': 'Whether or not someone suffered emotionally or was hurt in some way.',
     'metric_label': '% RELEVANT — Care: Suffering / Emotional Harm [Care1 → CFS]'},
    {'battery': 'mfq', 'id': 'QMFQr2', 'code': 'MFQ_CARE_2',
     'wording': 'Whether or not someone showed compassion and concern for people who were worse off.',
     'metric_label': '% RELEVANT — Care: Compassion for Worse Off [Care2 → CFS]'},
    {'battery': 'mfq', 'id': 'QMFQr3', 'code': 'MFQ_PURITY_1',
     'wording': 'Whether or not something was morally disgusting or violated widely shared standards of decency.',
     'metric_label': '% RELEVANT — Purity: Moral Disgust / Decency [Purity1 → PFS]'},
    {'battery': 'mfq', 'id': 'QMFQr4', 'code': 'MFQ_PURITY_2',
     'wording': 'Whether or not something went against the natural order or violated what many people consider sacred.',
     'metric_label': '% RELEVANT — Purity: Natural Order / Sacred [Purity2 → PFS]'},
    {'battery': 'mfq', 'id': 'QMFQr5', 'code': 'MFQ_FAIR',
     'wording': 'Whether or not someone was treated fairly and got what they deserved.',
     'metric_label': '% RELEVANT — Fairness: Just Deserts'},
    {'battery': 'mfq', 'id': 'QMFQr6', 'code': 'MFQ_LIBERTY',
     'wording': "Whether or not a person's individual freedom or right to make their own choices was restricted.",
     'metric_label': '% RELEVANT — Liberty: Individual Freedom Restricted'},
    {'battery': 'mfq', 'id': 'QMFQr7', 'code': 'MFQ_LOYALTY',
     'wording': 'Whether or not someone was loyal to the people and groups they belong to.',
     'metric_label': '% RELEVANT — Loyalty: In-Group Loyalty'},
    {'battery': 'mfq', 'id': 'QMFQr8', 'code': 'MFQ_AUTHORITY',
     'wording': 'Whether or not someone showed proper respect for authority and traditional social roles.',
     'metric_label': '% RELEVANT — Authority: Respect for Tradition'},

    # ── Critics battery (11 items) ────────────────────────────────────
    {'battery': 'critics', 'id': 'QCRITICr1',  'code': 'CRITIC_1',
     'wording': 'People who contract HIV as a result of their own sexual behavior are largely responsible for managing the consequences.',
     'metric_label': '% AGREE — HIV Result of Sexual Choices'},
    {'battery': 'critics', 'id': 'QCRITICr2',  'code': 'CRITIC_2',
     'wording': 'Providing government funding for HIV prevention programs sends the wrong message by reducing the consequences of risky behavior.',
     'metric_label': '% AGREE — Funding Prevention: Moral Hazard'},
    {'battery': 'critics', 'id': 'QCRITICr3',  'code': 'CRITIC_3',
     'wording': 'HIV is no longer the public health emergency it once was — other health crises deserve more attention and resources today.',
     'metric_label': '% AGREE — Not an Emergency Anymore'},
    {'battery': 'critics', 'id': 'QCRITICr4',  'code': 'CRITIC_4',
     'wording': 'With limited resources for public health, it makes sense to shift funding away from HIV toward conditions like the opioid crisis and mental health.',
     'metric_label': '% AGREE — Opioid Crisis / Mental Health Bigger Priority'},
    {'battery': 'critics', 'id': 'QCRITICr5',  'code': 'CRITIC_5',
     'wording': 'Reducing the federal deficit and controlling government spending should take priority over maintaining current levels of HIV funding.',
     'metric_label': '% AGREE — Control Deficit Spending Bigger Priority'},
    {'battery': 'critics', 'id': 'QCRITICr6',  'code': 'CRITIC_6',
     'wording': 'HIV treatment and prevention programs have received a disproportionate share of public health funding relative to the size of the affected population.',
     'metric_label': '% AGREE — Spending on HIV Disproportionate to Impact'},
    {'battery': 'critics', 'id': 'QCRITICr7',  'code': 'CRITIC_7',
     'wording': 'HIV is primarily a problem affecting specific communities and lifestyle choices — most Americans do not need to see it as their concern.',
     'metric_label': '% AGREE — HIV Affects Communities and Lifestyle Choices'},
    {'battery': 'critics', 'id': 'QCRITICr8',  'code': 'CRITIC_8',
     'wording': 'The people most affected by HIV in the United States are concentrated in communities with behaviors and values very different from most Americans.',
     'metric_label': '% AGREE — HIV Affects Communities Different from Most Americans'},
    {'battery': 'critics', 'id': 'QCRITICr9',  'code': 'CRITIC_9',
     'wording': 'Resources spent on HIV primarily benefit populations in large cities — rural and suburban communities have more pressing health needs.',
     'metric_label': '% AGREE — Resource Needs are Outside of Urban Areas'},
    {'battery': 'critics', 'id': 'QCRITICr10', 'code': 'CRITIC_10',
     'wording': 'States should have full flexibility to decide how to allocate HIV prevention and treatment funding rather than being directed by Washington.',
     'metric_label': '% AGREE — States Should Decide'},
    {'battery': 'critics', 'id': 'QCRITICr11', 'code': 'CRITIC_11',
     'wording': 'Federal HIV programs have too much waste and inefficiency to justify continued investment at current levels.',
     'metric_label': '% AGREE — Waste in Federal HIV Programs'},
]

PRE_POST = [
    {'id': 'PP1', 'pre_var':'XQPRE_1r1r1', 'post_var':'XPOST_1r1r1',
        'code':'PRE_1 / POST_1', 'section':'prepost',
        'wording':'People have different views about which health issues should be the top priority for elected officials. Please rank the following health issues from 1 (most important) to 7 (least important). [Rank shown for HIV/AIDS, recoded so 7 = top priority.]',
        'scale_anchors': ['Ranked LAST (1)','Middle (4)','Ranked FIRST (7)'],
        'survey': {
            'style': 'RANKSORT', 'progress': '1 of 7 issues',
            'stem': 'Drag each issue to its ranking (1 = most important).',
            'items': ['HIV/AIDS','Cancer','Mental health and addiction','Obesity and Diabetes','Heart disease',"Alzheimer's and dementia",'Maternal health'],
            'focal': 'HIV/AIDS',
        },
        'codebook': {
            'var_pre':'QPRE_1r1 → XQPRE_1r1r1 (recoded 8 − rank, so 7 = top priority)',
            'var_post':'QPOST_1r1 → XPOST_1r1r1',
            'scale_type':'Forced rank (1–7) across 7 health issues',
            'filter':'All respondents (n=975)',
            'block':'PRE block · randomized issue order',
            'recode':'Reverse to ascending priority: XQPRE_1r1r1 = 8 − QPRE_1r1',
            'design_note':'Single-item priority rank for HIV/AIDS extracted from the full ranking task.',
        },
        'metric_label':'% RANKING HIV/AIDS A TOP-3 PRIORITY',
        'metric_label_scale':'Top-3 positions (5-7) of recoded 7-pt rank (7 = top priority)'},
    {'id':'PP2','pre_var':'QPRE_2','post_var':'QPOST_2','code':'PRE_2 / POST_2','section':'prepost',
        'wording':'How concerned are you about the impact of HIV/AIDS on your local community?',
        'scale_anchors':['NOT AT ALL Concerned (1)','Neutral (4)','EXTREMELY Concerned (7)'],
        'survey': {
            'style':'CARDSHUFFLE','progress':'2 of 7 PRE items',
            'stem':'How concerned are you about the impact of HIV/AIDS on your local community?',
            'text':'',
            'anchor_left':'Not at all\nConcerned','anchor_center':'Neutral','anchor_right':'Extremely\nConcerned',
        },
        'codebook':{'var_pre':'QPRE_2','var_post':'QPOST_2','scale_type':'7-pt concern (1–7)',
            'filter':'All respondents','block':'PRE Block A (rotated with Block B at exposure)',
            'recode':'None','design_note':'Local-impact concern measure; appears identically in PRE and POST.',
        },
        'metric_label':'% CONCERNED — Local Impact of HIV/AIDS',
        'metric_label_scale':'Top-3 Box (5-7) of 7-pt concern scale'},
    {'id':'PP3','pre_var':'QPRE_3','post_var':'QPOST_3','code':'PRE_3 / POST_3','section':'prepost',
        'wording':'How concerned are you about the impact that reduced access to HIV prevention and treatment would have on your community?',
        'scale_anchors':['NOT AT ALL Concerned (1)','Neutral (4)','EXTREMELY Concerned (7)'],
        'survey':{'style':'CARDSHUFFLE','progress':'3 of 7 PRE items',
            'stem':'How concerned are you about the impact that reduced access to HIV prevention and treatment would have on your community?',
            'text':'','anchor_left':'Not at all\nConcerned','anchor_center':'Neutral','anchor_right':'Extremely\nConcerned'},
        'codebook':{'var_pre':'QPRE_3','var_post':'QPOST_3','scale_type':'7-pt concern (1–7)',
            'filter':'All respondents','block':'PRE Block A','recode':'None',
            'design_note':'Reduced-access concern; central instrumental outcome.'},
        'metric_label':'% CONCERNED — Reduced Access to HIV Care',
        'metric_label_scale':'Top-3 Box (5-7) of 7-pt concern scale'},
    {'id':'PP4','pre_var':'QPRE_4','post_var':'QPOST_4','code':'PRE_4 / POST_4','section':'prepost',
        'wording':'How much does the issue of HIV/AIDS feel relevant to you personally or to your community?',
        'scale_anchors':['NOT AT ALL Relevant (1)','Neutral (4)','EXTREMELY Relevant (7)'],
        'survey':{'style':'CARDSHUFFLE','progress':'4 of 7 PRE items',
            'stem':'How much does the issue of HIV/AIDS feel relevant to you personally or to your community?',
            'text':'','anchor_left':'Not at all\nRelevant','anchor_center':'Neutral','anchor_right':'Extremely\nRelevant'},
        'codebook':{'var_pre':'QPRE_4','var_post':'QPOST_4','scale_type':'7-pt relevance (1–7)',
            'filter':'All respondents','block':'PRE Block A','recode':'None',
            'design_note':'Personal / community relevance; salience indicator.'},
        'metric_label':'% RELEVANT — HIV/AIDS to Me or My Community',
        'metric_label_scale':'Top-3 Box (5-7) of 7-pt relevance scale'},
    {'id':'PP5','pre_var':'QPRE_5','post_var':'QPOST_5','code':'PRE_5 / POST_5','section':'prepost',
        'wording':'Do you support or oppose expanding access to HIV prevention medications like PrEP and HIV treatment programs?',
        'scale_anchors':['Strongly OPPOSE (1)','Neutral (4)','Strongly SUPPORT (7)'],
        'survey':{'style':'CARDSHUFFLE','progress':'5 of 7 PRE items',
            'stem':'Do you support or oppose expanding access to HIV prevention medications like PrEP and HIV treatment programs?',
            'text':'','anchor_left':'Strongly\nOppose','anchor_center':'Neutral','anchor_right':'Strongly\nSupport'},
        'codebook':{'var_pre':'QPRE_5','var_post':'QPOST_5','scale_type':'7-pt support-oppose (1–7)',
            'filter':'All respondents','block':'PRE Block A','recode':'None',
            'design_note':'PrEP / treatment expansion. Core policy support metric.'},
        'metric_label':'% SUPPORT — Expanding PrEP and HIV Treatment Access',
        'metric_label_scale':'Top-3 Box (5-7) of 7-pt support-oppose scale'},
    {'id':'PP6','pre_var':'XQPRE_6R','post_var':'XPOST_6R','code':'PRE_6R / POST_6R (reversed)','section':'prepost',
        'data_inverted_for_display': True,
        'wording':'Some states are considering reducing eligibility for HIV treatment assistance programs in order to address budget shortfalls. Do you support or oppose such reductions?',
        'scale_anchors':['Strongly SUPPORT reductions (1)','Neutral (4)','Strongly OPPOSE reductions (7)'],
        'survey':{'style':'CARDSHUFFLE','progress':'6 of 7 PRE items',
            'stem':'Some states are considering reducing eligibility for HIV treatment assistance programs in order to address budget shortfalls and reduce the burden on taxpayers. Do you support or oppose such reductions?',
            'text':'','anchor_left':'Strongly\nOppose','anchor_center':'Neutral','anchor_right':'Strongly\nSupport'},
        'codebook':{'var_pre':'QPRE_6 → XQPRE_6R','var_post':'QPOST_6 → XPOST_6R',
            'scale_type':'7-pt support-oppose, REVERSED so high = pro-access',
            'filter':'All respondents','block':'PRE Block A',
            'recode':'XQPRE_6R = 8 − QPRE_6 (reverse-coded)',
            'design_note':'Counter-pressure / reductions item. Reversed so all PRE/POST items run in the same pro-access direction.'},
        'metric_label':'% OPPOSE — Reductions in HIV Treatment Eligibility',
        'metric_label_scale':'Top-3 Box (5-7) of reverse-coded 7-pt scale (high = pro-access)'},
    {'id':'PP7','pre_var':'QPRE_7r1','post_var':'QPOST_7r1','code':'PRE_7 / POST_7','section':'prepost',
        'wording':'Which statement comes closest to your view? (1) "We already have medicines that effectively treat and prevent HIV…" vs. (7) "The next generation of HIV treatment and prevention will do what existing medicines cannot. That innovation requires continued investment."',
        'scale_anchors':['Strong A: access (1)','Neutral (4)','Strong B: innovation (7)'],
        'survey':{'style':'SEMANTIC','progress':'7 of 7 PRE items',
            'stem':'Which statement comes closer to your view?',
            'pole_left':'We already have medicines that effectively treat and prevent HIV. The focus should be on getting those medicines to the people who need them — not on developing newer, more expensive options.',
            'pole_right':'The next generation of HIV treatment and prevention will do what existing medicines cannot — make adherence easier, reach more people, and move us closer to a cure. That innovation requires continued investment.'},
        'codebook':{'var_pre':'QPRE_7r1','var_post':'QPOST_7r1','scale_type':'7-pt semantic differential (1–7)',
            'filter':'All respondents','block':'PRE Block A',
            'recode':'None','design_note':'Forced-choice instrumental outcome. High = pro-innovation.'},
        'metric_label':'% PRO-INNOVATION — Forced Choice (Access vs. Innovation)',
        'metric_label_scale':'Top-3 Box (5-7) of 7-pt semantic differential (high = innovation pole)'},
]

# ═════════════════════════════════════════════════════════════════════
# STATISTICS HELPERS (do not edit per study)
# ═════════════════════════════════════════════════════════════════════

def ztest_prop_vs_rest(seg_count, seg_n, total_count, total_n):
    """Two-proportion z-test: segment vs. (total minus segment)."""
    rest_n = total_n - seg_n
    if rest_n <= 0 or seg_n <= 0:
        return 0.0
    rest_count = total_count - seg_count
    p1 = seg_count / seg_n
    p2 = rest_count / rest_n
    p_pool = (seg_count + rest_count) / (seg_n + rest_n)
    if p_pool <= 0 or p_pool >= 1:
        return 0.0
    se = sqrt(p_pool * (1 - p_pool) * (1/seg_n + 1/rest_n))
    if se == 0:
        return 0.0
    return (p1 - p2) / se

def sig_level(z):
    az = abs(z)
    if az >= 2.576: return 2  # p < .01
    if az >= 1.96:  return 1  # p < .05
    return 0

def _norm_sf_two_sided(z):
    """Two-sided p-value from a z statistic, via erfc. No scipy dependency."""
    from math import erfc, sqrt as _sqrt
    return erfc(abs(z) / _sqrt(2.0))

def _binom_p_two_sided_half(n, k):
    """Two-sided p-value for binomial(n, 0.5), point mass at k or more extreme.
    Used for exact McNemar when discordant n < 25.
    """
    from math import comb
    k_extreme = max(k, n - k)
    tail = sum(comb(n, i) for i in range(k_extreme, n + 1))
    p = 2.0 * tail / (2.0 ** n)
    return min(p, 1.0)

def mcnemar_test(b, c):
    """McNemar's paired test on a 2x2 of top-3 status (PRE vs POST).
    b = count of respondents who moved 0 -> 1 (not-top3 PRE, top3 POST)
    c = count of respondents who moved 1 -> 0 (top3 PRE, not-top3 POST)
    Returns (chi_square_or_None, p_value, method_key).
    method_key maps to LABELS at render time:
      'method_mcnemar_chi2' / 'method_mcnemar_exact' / 'method_no_discord'.
    """
    n = b + c
    if n == 0:
        return None, 1.0, 'method_no_discord'
    if n >= 25:
        chi2 = (abs(b - c) - 1) ** 2 / n
        z = chi2 ** 0.5
        p = _norm_sf_two_sided(z)
        return round(chi2, 2), p, 'method_mcnemar_chi2'
    else:
        p = _binom_p_two_sided_half(n, max(b, c))
        return None, p, 'method_mcnemar_exact'

def delta_sig_level(p):
    """Three-tier sig level for delta tests: 0=ns, 1=p<.10, 2=p<.05, 3=p<.01."""
    if p < 0.01: return 3
    if p < 0.05: return 2
    if p < 0.10: return 1
    return 0

def welch_t_two_sample(x1, x2):
    """Welch's t-test on two independent samples of continuous values.
    Returns (t_statistic, p_value_two_sided). Used for Delta-vs-rest popover info.
    """
    from math import sqrt as _sqrt
    n1, n2 = len(x1), len(x2)
    if n1 < 2 or n2 < 2:
        return 0.0, 1.0
    m1 = sum(x1) / n1
    m2 = sum(x2) / n2
    v1 = sum((x - m1) ** 2 for x in x1) / (n1 - 1)
    v2 = sum((x - m2) ** 2 for x in x2) / (n2 - 1)
    se = _sqrt(v1 / n1 + v2 / n2)
    if se == 0:
        return 0.0, 1.0
    t = (m1 - m2) / se
    # Approximate two-sided p via normal (Welch df not needed for our use)
    p = _norm_sf_two_sided(t)
    return t, p

def _stats(values, weights, scale=7):
    mask = values.notna()
    v = values[mask]; w = weights[mask]
    if len(v) == 0: return None
    n = int(mask.sum())
    n_wgt = float(w.sum())
    mean = float((v * w).sum() / w.sum())
    freq, counts = [], []
    for k in range(1, scale+1):
        f = float(w[v == k].sum() / w.sum() * 100)
        c = int((v == k).sum())
        freq.append(round(f, 1)); counts.append(c)
    bot3 = round(sum(freq[0:3]), 1)
    neut = round(freq[3], 1)
    top3 = round(sum(freq[4:7]), 1)
    return {
        'n': n, 'n_wgt': round(n_wgt, 1), 'mean': round(mean, 2),
        'freq': freq, 'bot3': bot3, 'neut': neut, 'top3': top3,
        'net': round(top3 - bot3, 1),
        'top3_count': sum(counts[4:7]), 'bot3_count': sum(counts[0:3]),
    }

def _clamp(v, lo=1, hi=7):
    return max(lo, min(hi, int(round(v))))


def _freq_for_var(values, weights, mask, options, recode=None):
    """Compute frequency distribution of `values` (filtered by `mask`)
    across the response-option list. Returns dict keyed by option value with
    {n, pct, n_wgt, pct_wgt} per option, plus '_n_total' and '_n_wgt_total'.

    Optional `recode` argument applies a value transformation before tallying.
    Currently supports {'ruca_collapse': True} which maps RUCA 1-3 → 'urban',
    4-6 → 'suburban', 7-10 → 'rural'.
    """
    v = values[mask]
    w = weights[mask]
    # Apply recode if needed
    if recode and recode.get('ruca_collapse'):
        v = v.apply(_ruca_collapse)
    n_total = int(mask.sum())
    n_wgt_total = float(w.sum())
    out = {'_n_total': n_total, '_n_wgt_total': round(n_wgt_total, 1)}
    for opt in options:
        opt_val = opt[0]
        sel = (v == opt_val)
        n = int(sel.sum())
        n_wgt = float(w[sel].sum())
        out[opt_val] = {
            'n':       n,
            'pct':     round(n / n_total * 100, 1) if n_total else 0.0,
            'n_wgt':   round(n_wgt, 1),
            'pct_wgt': round(n_wgt / n_wgt_total * 100, 1) if n_wgt_total else 0.0,
        }
    return out


def _ruca_collapse(val):
    """Collapse 10-level RUCA to 5 categories.

    Urban = 1
    Suburban = 2-3
    Exurban = 4-6
    Small Town Rural = 7-9
    Rural = 10
    """
    if pd.isna(val):
        return None
    v = int(val)
    if v == 1:
        return 'urban'
    if 2 <= v <= 3:
        return 'suburban'
    if 4 <= v <= 6:
        return 'exurban'
    if 7 <= v <= 9:
        return 'smalltown'
    if v == 10:
        return 'rural'
    return None


def _influencer_cell(values, weights, mask, metric, entry):
    """Compute one Influencer360 banner cell value depending on metric type.

    metric:
      'pct_yes'       → entry['yes_value'] default 1, returns % matching that value
      'any_activity'  → returns % not matching entry['never_value'] (default 1)
                        i.e., share who reported any activity above 'Never'
      'mean'          → returns weighted mean (used for BCS / XSMr4)
      'categorical'   → returns full distribution dict {value: pct, ...}

    Returns a dict with at minimum: {'n', 'val'} where val depends on metric.
    Also returns 'count' (raw matching unweighted count) for proportional metrics,
    and 'values' (raw value list) for 'mean' metric — both used downstream for
    significance testing.
    """
    v = values[mask]
    w = weights[mask]
    n = int(mask.sum())
    n_wgt = float(w.sum())
    if metric == 'mean':
        if n_wgt > 0:
            wm = (v * w).sum() / n_wgt
        else:
            wm = 0.0
        # Return raw values list (used by Welch t-test downstream); also keep
        # the indices so we can filter rest-of-sample for the t-test.
        return {'n': n, 'val': round(float(wm), 3), 'metric': 'mean',
                'mask': mask, '_is_mean': True}
    if metric == 'categorical':
        opts = entry.get('options', [])
        return {
            'n': n,
            'metric': 'categorical',
            'dist': _freq_for_var(values, weights, mask, opts),
        }
    if metric == 'any_activity':
        never_val = entry.get('never_value', 1)
        any_mask = (v != never_val)
        any_count = int(any_mask.sum())
        any_n_wgt = float(w[any_mask].sum())
        pct = (any_n_wgt / n_wgt * 100) if n_wgt > 0 else 0.0
        return {'n': n, 'val': round(pct, 1), 'metric': 'any_activity', 'count': any_count}
    # Default: pct_yes
    yes_val = entry.get('yes_value', 1)
    yes_mask = (v == yes_val)
    yes_count = int(yes_mask.sum())
    yes_n_wgt = float(w[yes_mask].sum())
    pct = (yes_n_wgt / n_wgt * 100) if n_wgt > 0 else 0.0
    return {'n': n, 'val': round(pct, 1), 'metric': 'pct_yes', 'count': yes_count}


def expand_battery_items(items, batteries):
    """Walk ITEMS and expand any entry referencing a battery.

    An item with 'battery': '<name>' inherits all defaults from BATTERIES[<name>],
    with three conveniences auto-filled:
      - survey.intro    → only on the first item in the battery
      - survey.progress → '{position} of {total} statements'
      - survey.text     → defaults to item.wording
      - codebook.var    → defaults to item.id

    Items that don't reference a battery pass through unchanged.

    'position_override' on an item forces its survey position number (used when
    only one of an N-item battery is in the data, e.g., stigma SB_1 showing
    as '3 of 13'). Otherwise position is auto-incremented within the battery.
    """
    import copy
    expanded = []
    battery_position = {}  # tracks per-battery position counter
    for raw in items:
        if 'battery' not in raw:
            expanded.append(copy.deepcopy(raw))
            continue
        bname = raw['battery']
        if bname not in batteries:
            raise KeyError(f"Item {raw.get('id')} references unknown battery '{bname}'")
        battery = batteries[bname]
        # Position within the battery (auto-increment unless overridden)
        if 'position_override' in raw:
            position = raw['position_override']
        else:
            position = battery_position.get(bname, 0) + 1
            battery_position[bname] = position
        # Don't increment counter for overridden items
        if 'position_override' not in raw:
            battery_position[bname] = position
        total = battery.get('total', position)
        is_first_in_battery = (position == 1)

        # Build merged item starting from battery defaults
        merged = {}
        # Top-level inherited fields
        for k in ('section', 'scale', 'scale_anchors', 'metric_label_scale'):
            if k in battery:
                merged[k] = copy.deepcopy(battery[k])
        # Survey: deep-merge battery defaults with item overrides
        survey = copy.deepcopy(battery.get('survey', {}))
        if 'survey' in raw:
            survey.update(raw['survey'])
        # Auto-fills for survey
        if 'progress' not in survey:
            survey['progress'] = f'{position} of {total} statements'
        if 'text' not in survey:
            survey['text'] = raw.get('wording', '')
        # Intro only on first item in battery
        if not is_first_in_battery and 'intro' in survey:
            survey.pop('intro')
        merged['survey'] = survey
        # Codebook: deep-merge
        codebook = copy.deepcopy(battery.get('codebook', {}))
        if 'codebook' in raw:
            codebook.update(raw['codebook'])
        if 'codebook_extra' in raw:
            codebook.update(raw['codebook_extra'])
        if 'var' not in codebook:
            codebook['var'] = raw.get('id', '')
        merged['codebook'] = codebook

        # Now overlay item's own fields (overrides anything from the battery)
        for k, v in raw.items():
            if k in ('battery', 'survey', 'codebook', 'codebook_extra', 'position_override'):
                continue
            merged[k] = v

        expanded.append(merged)
    return expanded

# ═════════════════════════════════════════════════════════════════════
# MAIN BUILD FUNCTION — call this from any entry point
# ═════════════════════════════════════════════════════════════════════

def build_topline(df, out_dir='.', weight_var=None):
    """Compute all stats and write dashboard.json + results_long.csv + dashboard.html.

    Parameters
    ----------
    df : pandas.DataFrame
        Active dataset. Must contain XSEG_ASSIGNED and all variables
        referenced in ITEMS / PRE_POST.
    out_dir : str or Path
        Directory to write outputs into. Defaults to current directory.
    weight_var : str, optional
        Name of the weight column in df. If None, applies WGT = 1.0
        (unweighted; matches preliminary-data convention).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Defensive copy so we don't mutate the caller's dataframe
    df = df.copy()

    # Weight
    if weight_var is not None:
        if weight_var not in df.columns:
            raise KeyError(f"Weight variable '{weight_var}' not in dataframe columns")
        df['WGT'] = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0)
    else:
        df['WGT'] = 1.0

    # Segment code from XSEG_ASSIGNED
    if 'XSEG_ASSIGNED' not in df.columns:
        raise KeyError("XSEG_ASSIGNED not in dataframe columns. PRISM-canonical segmentation required.")
    seg_id2code = {sid: code for sid, code, _, _ in SEGMENTS}
    df['SEG'] = pd.to_numeric(df['XSEG_ASSIGNED'], errors='coerce').map(seg_id2code)

    def _compute_item(var):
        """Compute Total + 16-segment stats for one variable."""
        if var not in df.columns:
            raise KeyError(f"Variable '{var}' not in dataframe columns")
        # Numeric-ify in case it came in as object/string from SPSS
        col = pd.to_numeric(df[var], errors='coerce')
        out = OrderedDict()
        s = _stats(col, df['WGT'])
        if s: out['TOTAL'] = s
        total = out.get('TOTAL')
        for sid, code, name, party in SEGMENTS:
            mask = df['SEG'] == code
            s = _stats(col[mask], df['WGT'][mask])
            if s:
                if total:
                    z = ztest_prop_vs_rest(s['top3_count'], s['n'], total['top3_count'], total['n'])
                    s['z_top3'] = round(z, 2)
                    s['sig_top3'] = sig_level(z)
                    s['sig_dir'] = (1 if z > 0 else -1) if s['sig_top3'] > 0 else 0
                out[code] = s
        return out

    # Sample composition
    STUDY_TOTAL_N = int(len(df))
    STUDY_TOTAL_N_WGT = float(df['WGT'].sum())
    total_n = STUDY_TOTAL_N           # kept as alias for downstream code that uses it locally
    total_n_wgt = STUDY_TOTAL_N_WGT
    sample = []
    for sid, code, name, party in SEGMENTS:
        sub = df[df['SEG'] == code]
        n = int(len(sub))
        n_wgt = float(sub['WGT'].sum())
        sample.append({
            'id': sid, 'code': code, 'name': name, 'party': party,
            'n': n, 'n_wgt': round(n_wgt, 1),
            'pct': round(n / total_n * 100, 1) if total_n else 0,
            'pct_wgt': round(n_wgt / total_n_wgt * 100, 1) if total_n_wgt else 0,
        })

    # ── Expand any battery-referenced items into fully-formed item dicts ──
    items_expanded = expand_battery_items(ITEMS, BATTERIES)

    # Items
    item_results = {it['id']: _compute_item(it['id']) for it in items_expanded}

    # PRE_POST
    pp_results = {}
    for pp in PRE_POST:
        pre = _compute_item(pp['pre_var'])
        post = _compute_item(pp['post_var'])

        # ── Paired test prep: for each cut, get the per-respondent top-3 indicators
        # for PRE and POST, restricted to respondents with valid responses on BOTH.
        pre_col = pd.to_numeric(df[pp['pre_var']], errors='coerce')
        post_col = pd.to_numeric(df[pp['post_var']], errors='coerce')
        paired_mask_all = pre_col.notna() & post_col.notna()
        pre_t3 = (pre_col.between(5, 7)).astype(int)
        post_t3 = (post_col.between(5, 7)).astype(int)

        # Compute Total delta-top-3 vector (POST top3 - PRE top3 per respondent)
        # for the Δ-vs-rest test (Option 2).
        delta_t3_signed = (post_t3 - pre_t3).where(paired_mask_all)

        def _paired_stats_for_cut(cut_mask):
            """Return McNemar stats for the cut."""
            m = paired_mask_all & cut_mask
            a = int(((pre_t3 == 0) & (post_t3 == 0) & m).sum())  # stayed not-top3
            b = int(((pre_t3 == 0) & (post_t3 == 1) & m).sum())  # 0 -> 1 (gained)
            c = int(((pre_t3 == 1) & (post_t3 == 0) & m).sum())  # 1 -> 0 (lost)
            d = int(((pre_t3 == 1) & (post_t3 == 1) & m).sum())  # stayed top3
            n_paired = a + b + c + d
            chi2, p, method = mcnemar_test(b, c)
            lvl = delta_sig_level(p)
            return {
                'n_paired': n_paired,
                'switch_gain': b,         # not-top3 → top3
                'switch_loss': c,         # top3 → not-top3
                'mcnemar_chi2': chi2,
                'mcnemar_p': round(p, 4),
                'mcnemar_method': method,
                'sig_delta': lvl,
                'sig_dir_delta': (1 if b > c else (-1 if c > b else 0)) if lvl > 0 else 0,
            }

        def _delta_vs_rest_for_cut(cut_mask):
            """Welch's t-test on segment Δ-top3 vs. rest-of-sample Δ-top3."""
            seg = delta_t3_signed[cut_mask].dropna()
            rest = delta_t3_signed[~cut_mask].dropna()
            t, p = welch_t_two_sample(list(seg), list(rest))
            lvl = delta_sig_level(p)
            return {
                't_delta_vs_rest': round(t, 2),
                'p_delta_vs_rest': round(p, 4),
                'sig_delta_vs_rest': lvl,
            }

        # Compute delta cells with sig
        delta = OrderedDict()

        # TOTAL row
        total_mask = pd.Series([True] * len(df), index=df.index)
        if 'TOTAL' in pre.keys() and 'TOTAL' in post.keys():
            d = {
                'mean': round(post['TOTAL']['mean'] - pre['TOTAL']['mean'], 2),
                'bot3': round(post['TOTAL']['bot3'] - pre['TOTAL']['bot3'], 1),
                'top3': round(post['TOTAL']['top3'] - pre['TOTAL']['top3'], 1),
                'net':  round(post['TOTAL']['net']  - pre['TOTAL']['net'],  1),
                'n_pre': pre['TOTAL']['n'], 'n_post': post['TOTAL']['n'],
            }
            d.update(_paired_stats_for_cut(total_mask))
            # Total has no "rest" to compare against
            d['t_delta_vs_rest'] = None
            d['p_delta_vs_rest'] = None
            d['sig_delta_vs_rest'] = 0
            delta['TOTAL'] = d

        # Segment rows
        for sid, code, name, party in SEGMENTS:
            if code in pre and code in post:
                cut_mask = (df['SEG'] == code)
                d = {
                    'mean': round(post[code]['mean'] - pre[code]['mean'], 2),
                    'bot3': round(post[code]['bot3'] - pre[code]['bot3'], 1),
                    'top3': round(post[code]['top3'] - pre[code]['top3'], 1),
                    'net':  round(post[code]['net']  - pre[code]['net'],  1),
                    'n_pre': pre[code]['n'], 'n_post': post[code]['n'],
                }
                d.update(_paired_stats_for_cut(cut_mask))
                d.update(_delta_vs_rest_for_cut(cut_mask))
                delta[code] = d

        pp_results[pp['id']] = {'pre': pre, 'post': post, 'delta': delta}

    # Survey-pane selected position (deep-copy registries so we don't mutate module globals)
    import copy
    pp_out = copy.deepcopy(PRE_POST)
    items_out = copy.deepcopy(items_expanded)
    for pp in pp_out:
        post_total = pp_results[pp['id']]['post'].get('TOTAL')
        if not post_total or not pp.get('survey'): continue
        mean = post_total['mean']
        style = pp['survey'].get('style', 'CARDSHUFFLE')
        is_inverted = pp.get('data_inverted_for_display', False)
        if style == 'RANKSORT':
            pos = _clamp(8 - mean)
            focal = pp['survey'].get('focal')
            items_list = list(pp['survey'].get('items', []))
            if focal in items_list:
                items_list.remove(focal)
                items_list.insert(pos - 1, focal)
                pp['survey']['items'] = items_list
        elif is_inverted:
            pos = _clamp(8 - mean)
        else:
            pos = _clamp(mean)
        pp['survey']['selected_pos'] = pos

    for it in items_out:
        total = item_results[it['id']].get('TOTAL')
        if not total or not it.get('survey'): continue
        mean = total['mean']
        is_inverted = it.get('data_inverted_for_display', False)
        pos = _clamp(8 - mean) if is_inverted else _clamp(mean)
        it['survey']['selected_pos'] = pos

    # ── Long-format CSV write deferred to end (after all compute) ──
    # We can't write the CSV here because demographics, influencer, and
    # stigma_extras compute hasn't run yet. The CSV write is moved to just
    # before the JSON write so all sources are represented.

    # Build segment_masks dict (used by Demographics and Influencer360 compute below)
    segment_masks = {s['code']: (df['SEG'] == s['code']) for s in sample}

    # ── Compute Demographics module (per-segment frequency distributions) ─
    demographics_data = []
    demo_active = any(m.get('id') == 'demos' and m.get('active') for m in MODULES)
    if demo_active:
        for dq in DEMOGRAPHICS:
            # ── binary_set style: multi-item block (e.g. Personal Contact) ──
            # Structurally like an Influencer binary_set block — N independent
            # binary items rendered as N rows, % Yes per segment.
            if dq.get('style') == 'binary_set':
                w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))
                entry = {
                    'id':              dq['id'],
                    'wording':         dq['wording'],
                    'style':           'binary_set',
                    'block_label':     dq.get('block_label', f"Demographics — {dq['id']}"),
                    'weight_relevant': dq.get('weight_relevant', False),
                    'pane_extra':      dq.get('pane_extra', {}),
                    'items':           [],
                }
                for item in dq['items']:
                    var = item['var']
                    if var not in df.columns:
                        print(f"WARNING: Demographics binary_set var {var} not in .sav; skipping")
                        continue
                    v = pd.to_numeric(df[var], errors='coerce')
                    cut_entry = {
                        'var':       var,
                        'code':      item['code'],
                        'wording':   item['wording'],
                        'category':  item.get('category', ''),
                        'cuts':      {},
                    }
                    cell_entry = {'yes_value': 1}
                    mask_total = v.notna()
                    cut_entry['cuts']['TOTAL'] = _influencer_cell(v, w, mask_total, 'pct_yes', cell_entry)
                    for s in sample:
                        seg_mask = segment_masks.get(s['code'])
                        if seg_mask is None: continue
                        mask = seg_mask & v.notna()
                        cut_entry['cuts'][s['code']] = _influencer_cell(v, w, mask, 'pct_yes', cell_entry)
                    # Sig testing (z-test of proportion vs. rest of sample)
                    total_count = cut_entry['cuts']['TOTAL'].get('count', 0)
                    total_n     = cut_entry['cuts']['TOTAL']['n']
                    for s in sample:
                        seg_cell = cut_entry['cuts'].get(s['code'])
                        if not seg_cell: continue
                        z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], total_count, total_n)
                        seg_cell['z']   = round(z, 2)
                        seg_cell['sig'] = sig_level(z)
                    entry['items'].append(cut_entry)
                demographics_data.append(entry)
                continue

            # ── Standard single-variable demographic (existing path) ──
            var = dq['var']
            if var not in df.columns:
                print(f"WARNING: Demographics variable {var} not in .sav; skipping")
                continue
            v = pd.to_numeric(df[var], errors='coerce')
            w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))
            # Build per-segment frequency dict, plus TOTAL and per-segment-cut frequencies
            entry = {
                'id':              dq['id'],
                'var':             var,
                'wording':         dq['wording'],
                'style':           dq['style'],
                'options':         dq['options'],
                'pane_extra':      dq.get('pane_extra', {}),
                'pane_meta':       dq.get('pane_meta', {}),
                'recode':          dq.get('recode', {}),
                'block_label':     dq.get('block_label', f"Demographics — {dq['id']}"),
                'weight_relevant': dq.get('weight_relevant', False),
                'derived_from':    dq.get('derived_from', ''),
                'freq':            {},
            }
            # TOTAL cut
            mask_total = v.notna()
            n_total_q = int(mask_total.sum())
            entry['freq']['TOTAL'] = _freq_for_var(v, w, mask_total, dq['options'], recode=dq.get('recode'))

            # Per-segment cuts
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None:
                    continue
                mask = seg_mask & v.notna()
                entry['freq'][s['code']] = _freq_for_var(v, w, mask, dq['options'], recode=dq.get('recode'))

            # ── Significance: z-test of proportion (segment vs. rest of sample) per cell ──
            # For each response option, compare segment % against the rest of the sample.
            total_freq = entry['freq']['TOTAL']
            for opt in dq['options']:
                opt_val = opt[0]
                total_cell = total_freq.get(opt_val)
                if not total_cell:
                    continue
                total_count = total_cell['n']
                total_n = total_freq['_n_total']
                for s in sample:
                    seg_freq = entry['freq'].get(s['code'])
                    if not seg_freq or opt_val not in seg_freq:
                        continue
                    seg_cell = seg_freq[opt_val]
                    z = ztest_prop_vs_rest(seg_cell['n'], seg_freq['_n_total'], total_count, total_n)
                    seg_cell['z']   = round(z, 2)
                    seg_cell['sig'] = sig_level(z)

            # For QAGE: also compute mean/median if pane_meta requests it
            if dq.get('pane_meta', {}).get('continuous_var'):
                cont_var = dq['pane_meta']['continuous_var']
                if cont_var in df.columns:
                    cont = pd.to_numeric(df[cont_var], errors='coerce')
                    entry['pane_meta']['mean'] = round(cont.mean(), 1) if cont.notna().any() else None
                    entry['pane_meta']['median'] = round(cont.median(), 1) if cont.notna().any() else None

            # Compute weight stats per category (only for weight-relevant variables).
            # Stats: range, median, mean of WGT within each response category.
            if entry['weight_relevant']:
                wstats = {}
                # Use the recoded values if recode applies
                v_for_stats = v.copy()
                if dq.get('recode', {}).get('ruca_collapse'):
                    v_for_stats = v.apply(_ruca_collapse)
                for opt in dq['options']:
                    opt_val = opt[0]
                    sel = (v_for_stats == opt_val)
                    ws = w[sel]
                    if len(ws) > 0:
                        wstats[opt_val] = {
                            'min':    round(float(ws.min()), 3),
                            'max':    round(float(ws.max()), 3),
                            'median': round(float(ws.median()), 3),
                            'mean':   round(float(ws.mean()), 3),
                        }
                entry['weight_stats'] = wstats
                # Overall WGT stats (across all valid)
                ws_all = w[mask_total]
                if len(ws_all) > 0:
                    entry['weight_overall'] = {
                        'min':    round(float(ws_all.min()), 3),
                        'max':    round(float(ws_all.max()), 3),
                        'median': round(float(ws_all.median()), 3),
                        'mean':   round(float(ws_all.mean()), 3),
                    }
            demographics_data.append(entry)
        print(f"Computed Demographics: {len(demographics_data)} questions")

    # ── Compute Influencer360 module — 5 blocks, demographics-style ──
    influencer_data = []
    inf_active = any(m.get('id') == 'influencer' and m.get('active') for m in MODULES)
    if inf_active:
        for blk in INFLUENCER_BLOCKS:
            block_entry = {
                'id':              blk['id'],
                'block_label':     blk['block_label'],
                'wording':         blk['wording'],
                'pane_subtitle':   blk.get('pane_subtitle', ''),
                'kind':            blk['kind'],
                'pane_style':      blk['pane_style'],
                'items':           [],
                'freq':            {},   # used only for categorical kind
                'options':         blk.get('options', []),  # used only for categorical kind
            }
            w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))

            if blk['kind'] == 'categorical':
                # Single variable, frequency distribution across response options
                var = blk['var']
                if var not in df.columns:
                    print(f"WARNING: Influencer var {var} missing; skipping block {blk['id']}")
                    continue
                v = pd.to_numeric(df[var], errors='coerce')
                block_entry['var'] = var
                mask_total = v.notna()
                block_entry['freq']['TOTAL'] = _freq_for_var(v, w, mask_total, blk['options'])
                for s in sample:
                    seg_mask = segment_masks.get(s['code'])
                    if seg_mask is None: continue
                    mask = seg_mask & v.notna()
                    block_entry['freq'][s['code']] = _freq_for_var(v, w, mask, blk['options'])
                block_entry['n_total'] = int(mask_total.sum())

                # Sig testing per option × segment (z-test of proportion vs. rest)
                total_freq = block_entry['freq']['TOTAL']
                for opt in blk['options']:
                    opt_val = opt[0]
                    tc = total_freq.get(opt_val)
                    if not tc:
                        continue
                    total_count = tc['n']
                    total_n = total_freq['_n_total']
                    for s in sample:
                        seg_freq = block_entry['freq'].get(s['code'])
                        if not seg_freq or opt_val not in seg_freq: continue
                        seg_cell = seg_freq[opt_val]
                        z = ztest_prop_vs_rest(seg_cell['n'], seg_freq['_n_total'], total_count, total_n)
                        seg_cell['z']   = round(z, 2)
                        seg_cell['sig'] = sig_level(z)

            else:
                # binary_set, frequency, or composites — N items, one row each
                metric = blk.get('metric', 'pct_yes')
                for item in blk['items']:
                    var = item['var']
                    if var not in df.columns:
                        print(f"WARNING: Influencer var {var} missing; skipping item {item['code']}")
                        continue
                    v = pd.to_numeric(df[var], errors='coerce')

                    # Per-item metric override (composites can have item-level metric, e.g., BCS = 'mean')
                    item_metric = item.get('metric', metric)

                    cut_entry = {
                        'var':         var,
                        'code':        item['code'],
                        'wording':     item['wording'],
                        'tier':        item.get('tier', ''),
                        'formula':     item.get('formula', ''),
                        'metric':      item_metric,
                        'cuts':        {},
                    }
                    # Hand the right metric/parameters to _influencer_cell
                    cell_entry = {
                        'yes_value':   blk.get('yes_value', 1),
                        'never_value': blk.get('never_value', 1),
                    }
                    mask_total = v.notna()
                    cut_entry['cuts']['TOTAL'] = _influencer_cell(v, w, mask_total, item_metric, cell_entry)
                    for s in sample:
                        seg_mask = segment_masks.get(s['code'])
                        if seg_mask is None: continue
                        mask = seg_mask & v.notna()
                        cut_entry['cuts'][s['code']] = _influencer_cell(v, w, mask, item_metric, cell_entry)

                    # ── Sig testing for this item ────────────────────────
                    total_cell = cut_entry['cuts']['TOTAL']
                    if item_metric == 'mean':
                        # Welch's t-test: segment values vs. rest-of-sample values
                        for s in sample:
                            seg_cell = cut_entry['cuts'].get(s['code'])
                            if not seg_cell: continue
                            seg_mask = segment_masks.get(s['code'])
                            rest_mask = (~seg_mask) & v.notna()
                            seg_vals = v[seg_mask & v.notna()].tolist()
                            rest_vals = v[rest_mask].tolist()
                            if len(seg_vals) < 2 or len(rest_vals) < 2:
                                seg_cell['t']   = 0.0
                                seg_cell['sig'] = 0
                                continue
                            t, p = welch_t_two_sample(seg_vals, rest_vals)
                            # Map p-value to existing 2-tier sig levels (p<.05, p<.01)
                            sig = 2 if p < 0.01 else (1 if p < 0.05 else 0)
                            seg_cell['t']   = round(t, 2)
                            seg_cell['p']   = round(p, 4)
                            seg_cell['sig'] = sig
                            # Strip the mask/values from the dict before JSON serialization
                            seg_cell.pop('mask', None)
                            seg_cell.pop('_is_mean', None)
                        total_cell.pop('mask', None)
                        total_cell.pop('_is_mean', None)
                    else:
                        # z-test of proportion: yes-count vs. (rest of sample yes-count)
                        total_count = total_cell.get('count', 0)
                        total_n = total_cell['n']
                        for s in sample:
                            seg_cell = cut_entry['cuts'].get(s['code'])
                            if not seg_cell: continue
                            z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], total_count, total_n)
                            seg_cell['z']   = round(z, 2)
                            seg_cell['sig'] = sig_level(z)

                    block_entry['items'].append(cut_entry)

            influencer_data.append(block_entry)
        n_items = sum(len(b.get('items', [])) for b in influencer_data) + sum(len(b.get('options', [])) for b in influencer_data if b['kind'] == 'categorical')
        print(f"Computed Influencer360: {len(influencer_data)} blocks, {n_items} total rows")

    # ── Compute HIV Stigma Extras: Knowledge block + Composites block ──
    # These render inside the HIV Stigma module after the HIVSTIGMA and MFQ
    # batteries, completing the umbrella section. Two blocks total.
    stigma_extras = {'knowledge': None, 'composites': None}
    stigma_active = any(m.get('id') == 'stigma' and m.get('active') for m in MODULES)
    if stigma_active:
        w_full = pd.to_numeric(df['WGT'], errors='coerce').fillna(1.0)

        # ── Knowledge block (11 binary items, % aware) ──
        # QHIVr1-r11 are coded 1=Heard before, 2=Not aware. We want % aware = % responding 1.
        # Item 5 ("epidemic effectively over") is the FALSE statement; awareness of it
        # is awareness of misinformation, flagged in the row label and codebook.
        knowledge_items_raw = [
            ('QHIVr1',  'HIV_K1',  'HIV weakens the immune system over time. Without treatment, it can progress to AIDS.', False),
            ('QHIVr2',  'HIV_K2',  'With modern treatment, people with HIV can live a normal lifespan but must remain on treatment for life.', False),
            ('QHIVr3',  'HIV_K3',  "People with HIV who are on effective treatment and have an undetectable viral load cannot sexually transmit HIV (U=U).", False),
            ('QHIVr4',  'HIV_K4',  'There are medications (PrEP) that, when taken correctly, are nearly 100% effective at preventing HIV infection.', False),
            ('QHIVr5',  'HIV_K5',  'New HIV diagnoses in the United States have reached zero — the epidemic is effectively over.', True),    # FALSE
            ('QHIVr6',  'HIV_K6',  'More than half of all new HIV diagnoses in the United States occur in the South.', False),
            ('QHIVr7',  'HIV_K7',  'Only about 1 in 3 Americans who could benefit from HIV prevention medication actually receives it.', False),
            ('QHIVr8',  'HIV_K8',  'Preventing one HIV infection can save the healthcare system hundreds of thousands of dollars in long-term treatment costs.', False),
            ('QHIVr9',  'HIV_K9',  'The Ryan White federal program provides HIV care to more than half of all Americans currently living with HIV.', False),
            ('QHIVr10', 'HIV_K10', 'PEPFAR — a U.S. government program — has provided HIV prevention/treatment globally, credited with saving an estimated 25 million lives since 2003.', False),
            ('QHIVr11', 'HIV_K11', 'HIV in the United States disproportionately affects Black Americans, who account for nearly 40% of new diagnoses while making up about 12% of the population.', False),
        ]

        # Compute % aware (= % responding 1) per segment for each item
        knowledge_block = {
            'id': 'knowledge', 'kind': 'binary_set',
            'block_label': 'HIV Stigma — HIV Knowledge / Awareness',
            'pane_subtitle': '"For each item, indicate whether or not you have heard this before, or if it\'s something you were not previously aware of." 11 items on a designed split sample (LOI-reduction allocation, ~80% of respondents, n=820 valid of 1,044). Cells show % aware (responded "Heard before"). Item K5 is the false statement (epidemic is over); awareness reflects exposure to misinformation.',
            'items': [],
        }
        for var, code, wording, is_false in knowledge_items_raw:
            if var not in df.columns:
                print(f"WARNING: Knowledge var {var} missing; skipping")
                continue
            v = pd.to_numeric(df[var], errors='coerce')
            # Recode 1=aware, 2=not aware → binary 1/0
            v_aware = (v == 1).astype(float)
            v_aware[v.isna()] = pd.NA
            cut_entry = {
                'var': var, 'code': code, 'wording': wording,
                'is_false': is_false, 'cuts': {},
            }
            cell_entry = {'yes_value': 1}
            mask_total = v.notna()
            cut_entry['cuts']['TOTAL'] = _influencer_cell(v_aware, w_full, mask_total, 'pct_yes', cell_entry)
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None: continue
                mask = seg_mask & v.notna()
                cut_entry['cuts'][s['code']] = _influencer_cell(v_aware, w_full, mask, 'pct_yes', cell_entry)
            # Sig per segment vs. rest
            tot_count = cut_entry['cuts']['TOTAL'].get('count', 0)
            tot_n = cut_entry['cuts']['TOTAL']['n']
            for s in sample:
                seg_cell = cut_entry['cuts'].get(s['code'])
                if not seg_cell: continue
                z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], tot_count, tot_n)
                seg_cell['z'] = round(z, 2)
                seg_cell['sig'] = sig_level(z)
            knowledge_block['items'].append(cut_entry)
        stigma_extras['knowledge'] = knowledge_block

        # ── Composites block (8 composites) ──
        # Each composite is computed in-pipeline from the raw item values; no
        # dependency on derived SPSS variables, so this works whether or not
        # the .sav has XMBS/XSDS/etc. precomputed.
        composites_block = {
            'id': 'stigma_composites', 'kind': 'composites',
            'block_label': 'HIV Stigma — Composites',
            'pane_subtitle': 'Eight composites computed from the items above (designed split sample · n≈820-833 valid depending on composite). Stigma family (MBS, SDS, EDS, SCS): 1-7 means on Likert scales. Moral Foundations (CFS, PFS): 1-7 means on relevance scales. SCF (Sanctity-Care): PFS − CFS, signed differential. HKS (HIV Knowledge): sum 0-10 of correct awareness items (K5 excluded as the false statement).',
            'items': [],
        }
        composite_defs = [
            # (code, label, var_list, formula_str, metric_type)
            ('MBS', 'Moral Blame Score',
             ['QHIVSTIGMAr1', 'QHIVSTIGMAr2'],
             'MBS = mean(QHIVSTIGMAr1, QHIVSTIGMAr2)',  'mean'),
            ('SDS', 'Social Distance / Comfort (HIV+)',
             ['QHIVSTIGMAr3', 'QHIVSTIGMAr4'],
             'SDS = mean(QHIVSTIGMAr3, QHIVSTIGMAr4) [higher = more comfort]', 'mean'),
            ('EDS', 'Excessive Demands Score (anti-LGBTQ)',
             ['QHIVSTIGMAr5', 'QHIVSTIGMAr6'],
             'EDS = mean(QHIVSTIGMAr5, QHIVSTIGMAr6)', 'mean'),
            ('SCS', 'Social Comfort (LGBTQ)',
             ['QHIVSTIGMAr7', 'QHIVSTIGMAr8'],
             'SCS = mean(QHIVSTIGMAr7, QHIVSTIGMAr8) [higher = more comfort]', 'mean'),
            ('CFS', 'Care Foundations Score',
             ['QMFQr1', 'QMFQr2'],
             'CFS = mean(QMFQr1, QMFQr2)', 'mean'),
            ('PFS', 'Purity Foundations Score',
             ['QMFQr3', 'QMFQr4'],
             'PFS = mean(QMFQr3, QMFQr4)', 'mean'),
            ('SCF', 'Sanctity-Care Differential',
             ['QMFQr3', 'QMFQr4', 'QMFQr1', 'QMFQr2'],
             'SCF = PFS − CFS  (positive = purity-leaning, negative = care-leaning)', 'mean_diff'),
            ('HKS', 'HIV Knowledge Score (0-10)',
             ['QHIVr1','QHIVr2','QHIVr3','QHIVr4','QHIVr6','QHIVr7','QHIVr8','QHIVr9','QHIVr10','QHIVr11'],
             'HKS = sum of (response==1) across K1-K11 excluding K5  (max=10)', 'sum_aware'),
        ]
        for code, label, var_list, formula, metric_type in composite_defs:
            # Skip if any required var is missing
            if not all(v in df.columns for v in var_list):
                missing = [v for v in var_list if v not in df.columns]
                print(f"WARNING: Composite {code} skipped, missing: {missing}")
                continue

            # Compute the row-level composite score per respondent
            if metric_type == 'mean':
                comp_series = df[var_list].apply(pd.to_numeric, errors='coerce').mean(axis=1)
            elif metric_type == 'mean_diff':
                # First 2 vars = Purity, last 2 vars = Care
                purity = df[var_list[0:2]].apply(pd.to_numeric, errors='coerce').mean(axis=1)
                care   = df[var_list[2:4]].apply(pd.to_numeric, errors='coerce').mean(axis=1)
                comp_series = purity - care
            elif metric_type == 'sum_aware':
                # Count of items where response == 1 (= "heard before / aware")
                comp_series = pd.DataFrame(
                    {v: (pd.to_numeric(df[v], errors='coerce') == 1).astype(float) for v in var_list}
                ).sum(axis=1)
            else:
                continue

            comp_entry = {
                'var': '+'.join(var_list), 'code': code, 'wording': label,
                'formula': formula, 'metric': 'mean', 'cuts': {},
            }
            mask_total = comp_series.notna()

            def _mean_cell(series, weights, mask):
                v = series[mask]
                wt = weights[mask]
                n = int(mask.sum())
                n_wgt = float(wt.sum())
                if n_wgt > 0:
                    val = (v * wt).sum() / n_wgt
                else:
                    val = 0.0
                return {'n': n, 'val': round(float(val), 3), 'metric': 'mean'}

            comp_entry['cuts']['TOTAL'] = _mean_cell(comp_series, w_full, mask_total)
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None: continue
                mask = seg_mask & comp_series.notna()
                comp_entry['cuts'][s['code']] = _mean_cell(comp_series, w_full, mask)

            # Sig: Welch's t for the segment vs. rest of sample
            for s in sample:
                seg_cell = comp_entry['cuts'].get(s['code'])
                if not seg_cell: continue
                seg_mask = segment_masks.get(s['code']) & comp_series.notna()
                rest_mask = (~segment_masks.get(s['code'])) & comp_series.notna()
                seg_vals = comp_series[seg_mask].tolist()
                rest_vals = comp_series[rest_mask].tolist()
                if len(seg_vals) >= 2 and len(rest_vals) >= 2:
                    t, p = welch_t_two_sample(seg_vals, rest_vals)
                    sig = 2 if p < 0.01 else (1 if p < 0.05 else 0)
                    seg_cell['t']   = round(t, 2)
                    seg_cell['p']   = round(p, 4)
                    seg_cell['sig'] = sig
                else:
                    seg_cell['t'] = 0.0
                    seg_cell['sig'] = 0

            composites_block['items'].append(comp_entry)
        stigma_extras['composites'] = composites_block
        print(f"Computed HIV Stigma extras: Knowledge {len(knowledge_block['items'])} items, Composites {len(composites_block['items'])} items")

    # ── Compute ROI module (if active) ─────────────────────────────
    roi_svg = ''
    roi_data = {}
    roi_active = any(m.get('id') == 'roi' and m.get('active') for m in MODULES)
    if roi_active:
        try:
            from roi_infographic import compute_roi_data, render_svg
            roi_data = compute_roi_data(df, weight_var=weight_var)
            roi_total_n = sum(r['n'] for r in roi_data.values())
            roi_svg = render_svg(roi_data, total_n=roi_total_n)
            print(f"Computed ROI module: {len(roi_data)} segments, SVG {len(roi_svg):,} chars")
        except Exception as e:
            print(f"WARNING: ROI module compute failed: {e}")
            roi_svg = ''
            roi_data = {}

    # ── Compute field_dates from SPSS 'date' variable (Completion timestamp) ──
    # SPSS internal date format = seconds since 1582-10-14.
    field_dates_str = STUDY.get('field_dates', 'TBD')
    if 'date' in df.columns:
        try:
            d = pd.to_numeric(df['date'], errors='coerce')
            base = pd.Timestamp('1582-10-14')
            dates = base + pd.to_timedelta(d.dropna(), unit='s')
            if len(dates) > 0:
                first = dates.min().strftime('%b %d, %Y')
                last  = dates.max().strftime('%b %d, %Y')
                field_dates_str = f"{first} – {last}" if first != last else first
        except Exception as e:
            print(f"WARNING: Could not parse date variable: {e}")

    # ── Compute average LOI from 'qtime' variable (seconds) ──
    # Use trimmed median (drop sub-5-second and over-60-minute extremes) and
    # report in minutes. Median is the convention for survey reporting since
    # it's robust to people who leave the survey open or rush.
    loi_minutes_str = STUDY.get('loi_minutes', None)
    if 'qtime' in df.columns:
        try:
            q = pd.to_numeric(df['qtime'], errors='coerce')
            trimmed = q[(q >= 5) & (q <= 3600)]
            if len(trimmed) > 0:
                median_min = trimmed.median() / 60.0
                loi_minutes_str = f"{median_min:.1f}"
        except Exception as e:
            print(f"WARNING: Could not compute LOI from qtime: {e}")

    # Default survey intro text (the welcome screen prose shown to respondents)
    survey_intro_default = (
        "Thanks for taking part. This survey helps us understand how people "
        "think about health care and public policy today. There are no right "
        "or wrong answers — we're interested in your point of view. Let's begin."
    )

    # ── Write long-format CSV (full audit trail across all sources) ─
    # One row per cell across every module: items + pre_post + demographics +
    # influencer + stigma_extras (knowledge + composites). The schema is wider
    # than any single source needs; columns not relevant to a row are empty.
    rows = []
    # Items (Critics, HIVSTIGMA, MFQ)
    for it in items_out:
        for cut, s in item_results[it['id']].items():
            rows.append({
                'source': 'items', 'item': it['id'], 'code': it['code'], 'wave': '', 'cut': cut,
                'n': s['n'], 'n_wgt': s['n_wgt'], 'metric': 'top3',
                'mean': s['mean'], 'top3': s['top3'], 'bot3': s['bot3'], 'net': s['net'],
                'pct': '', 'val': '',
                'f1': s['freq'][0], 'f2': s['freq'][1], 'f3': s['freq'][2],
                'f4': s['freq'][3], 'f5': s['freq'][4], 'f6': s['freq'][5], 'f7': s['freq'][6],
                'sig': s.get('sig_top3', 0), 'stat': s.get('z_top3', 0),
            })
    # Pre/Post
    for pp in pp_out:
        for wave_name, res in [('PRE', pp_results[pp['id']]['pre']), ('POST', pp_results[pp['id']]['post'])]:
            for cut, s in res.items():
                rows.append({
                    'source': 'pre_post', 'item': pp['id'], 'code': pp['code'], 'wave': wave_name, 'cut': cut,
                    'n': s['n'], 'n_wgt': s['n_wgt'], 'metric': 'top3',
                    'mean': s['mean'], 'top3': s['top3'], 'bot3': s['bot3'], 'net': s['net'],
                    'pct': '', 'val': '',
                    'f1': s['freq'][0], 'f2': s['freq'][1], 'f3': s['freq'][2],
                    'f4': s['freq'][3], 'f5': s['freq'][4], 'f6': s['freq'][5], 'f7': s['freq'][6],
                    'sig': s.get('sig_top3', 0), 'stat': s.get('z_top3', 0),
                })
    # Demographics
    for q in demographics_data:
        if q.get('style') == 'binary_set':
            for it in q.get('items', []):
                for cut, cell in it.get('cuts', {}).items():
                    rows.append({
                        'source': 'demos', 'item': it['var'], 'code': it['code'], 'wave': '', 'cut': cut,
                        'n': cell.get('n', ''), 'n_wgt': '',
                        'metric': 'pct_yes',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell.get('val', ''), 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
        else:
            for opt_val, opt_label in q.get('options', []):
                for cut, freq_dict in q.get('freq', {}).items():
                    cell = freq_dict.get(opt_val)
                    if not cell:
                        continue
                    rows.append({
                        'source': 'demos', 'item': q.get('var', ''),
                        'code': f"{q['id']}={opt_label}", 'wave': '', 'cut': cut,
                        'n': cell['n'], 'n_wgt': cell.get('n_wgt', ''),
                        'metric': 'pct',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell['pct'], 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
    # Influencer360
    for blk in influencer_data:
        if blk['kind'] == 'categorical':
            for opt_val, opt_label in blk.get('options', []):
                for cut, freq_dict in blk.get('freq', {}).items():
                    cell = freq_dict.get(opt_val)
                    if not cell:
                        continue
                    rows.append({
                        'source': 'influencer', 'item': blk.get('var', ''),
                        'code': f"{blk['id']}={opt_label}", 'wave': '', 'cut': cut,
                        'n': cell['n'], 'n_wgt': cell.get('n_wgt', ''),
                        'metric': 'pct',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell['pct'], 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
        else:
            for it in blk.get('items', []):
                for cut, cell in it.get('cuts', {}).items():
                    is_mean = cell.get('metric') == 'mean'
                    rows.append({
                        'source': 'influencer', 'item': it['var'], 'code': it['code'], 'wave': '', 'cut': cut,
                        'n': cell.get('n', ''), 'n_wgt': '',
                        'metric': cell.get('metric', ''),
                        'mean': cell.get('val', '') if is_mean else '',
                        'top3': '', 'bot3': '', 'net': '',
                        'pct': cell.get('val', '') if not is_mean else '',
                        'val': cell.get('val', ''),
                        'sig': cell.get('sig', 0),
                        'stat': cell.get('z', cell.get('t', 0)),
                    })
    # HIV Stigma extras: knowledge + composites
    if stigma_extras.get('knowledge') and stigma_extras['knowledge'].get('items'):
        for it in stigma_extras['knowledge']['items']:
            for cut, cell in it.get('cuts', {}).items():
                rows.append({
                    'source': 'knowledge', 'item': it['var'], 'code': it['code'],
                    'wave': 'FALSE' if it.get('is_false') else '', 'cut': cut,
                    'n': cell.get('n', ''), 'n_wgt': '',
                    'metric': 'pct_aware',
                    'mean': '', 'top3': '', 'bot3': '', 'net': '',
                    'pct': cell.get('val', ''), 'val': '',
                    'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                })
    if stigma_extras.get('composites') and stigma_extras['composites'].get('items'):
        for it in stigma_extras['composites']['items']:
            for cut, cell in it.get('cuts', {}).items():
                rows.append({
                    'source': 'composites', 'item': it['code'], 'code': it['code'], 'wave': '', 'cut': cut,
                    'n': cell.get('n', ''), 'n_wgt': '',
                    'metric': 'mean',
                    'mean': cell.get('val', ''), 'top3': '', 'bot3': '', 'net': '',
                    'pct': '', 'val': cell.get('val', ''),
                    'sig': cell.get('sig', 0),
                    'stat': cell.get('t', cell.get('z', 0)),
                })

    csv_path = out_dir / 'results_long.csv'
    pd.DataFrame(rows).to_csv(csv_path, index=False)
    # Source breakdown for the build log
    by_source = {}
    for r in rows:
        by_source[r['source']] = by_source.get(r['source'], 0) + 1
    print(f"Wrote {csv_path}: {len(rows)} rows · " + ' '.join(f'{k}={v}' for k, v in by_source.items()))

    # ── Write JSON snapshot ────────────────────────────────────────
    out = {
        'study': {**STUDY,
                  'n_total': STUDY_TOTAL_N,
                  'n_total_wgt': round(STUDY_TOTAL_N_WGT, 1),
                  'field_dates': field_dates_str,
                  'survey_intro': STUDY.get('survey_intro', survey_intro_default),
                  'loi_minutes': loi_minutes_str},
        'labels': LABELS,
        'modules': MODULES, 'segments': sample,
        'items': items_out, 'item_results': item_results,
        'pre_post': pp_out, 'pp_results': pp_results,
        'demographics': demographics_data,
        'influencer': influencer_data,
        'stigma_extras': stigma_extras,
        'roi_svg': roi_svg,
        'roi_data': roi_data,
    }
    json_path = out_dir / 'dashboard.json'
    with open(json_path, 'w') as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {json_path}")

    # ── Inject into template (if found alongside) ─────────────────
    template_path = out_dir / 'dashboard_template.html'
    if template_path.exists():
        html_path = out_dir / 'dashboard.html'
        tpl = template_path.read_text(encoding='utf-8')
        html = tpl.replace('__DATA_PLACEHOLDER__', json.dumps(out))
        html_path.write_text(html, encoding='utf-8')
        print(f"Wrote {html_path} ({len(html):,} bytes)")
    else:
        print(f"(No dashboard_template.html found in {out_dir}; skipped HTML build.)")

    print(f"Total n: {STUDY_TOTAL_N}, segments populated: {sum(1 for s in sample if s['n']>0)}")
    return out
