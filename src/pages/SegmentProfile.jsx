import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import IdeologyHeatmap from "./IdeologyHeatmap";
import HIVTab from "./HIVTab";
import { getAssignedTier, STUDY_META, STUDY_METRICS } from "../data/study";

// ─── SEGMENTS ──────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id:1, code:"TSP", name:"TRUST THE SCIENCE PRAGMATISTS", party:"GOP", pop:2,
    demo:{male:"53%",medAge:54,nonwhite:"12%",hhi:"$99K",college:"39%",rural:"31%",cenDiv:"West South Central",cenPct:"29%",pharmaTrust:3.71,corpTrust:3.98,govtTrust:4.26,m4a:"24%",vaxAvoid:"18%"},
    persona:{quote:"Free markets work best, but I defer to FDA and CDC experts on safety and innovation. I want solutions to improving access for rural America.",
      believe:"They believe America must remain a leader in science and medicine, and that patients --especially those in rural areas --deserve earlier access to innovation. They see rural healthcare infrastructure unraveling in front of them and view government support as essential to keeping hospitals alive.",
      want:"They want rural subsidies to stabilize hospitals and prevent service loss in their communities. They want faster FDA approvals, expanded “right-to-try” access, and strong NIH funding to drive research. They oppose sweeping federal takeovers but accept government’s role as a funder, enabler, and guarantor of access in fragile rural systems.",
      doWhat:"They vaccinate more than most GOP peers, trust hospitals and providers, and consistently elevate rural hospital access as a priority. They participate in policy debates by advocating for reforms that balance competition with public investment in infrastructure and science.",
      whoAre:"Median age ~54, predominantly white, male-leaning, with household incomes near $100k. They are the most rural cluster, anchored in communities facing healthcare decline. They are less religious than Traditional Conservatives, pragmatic in tone, and loyal Republicans --but not ideologically anti-government."}},
  { id:2, code:"CEC", name:"CONSUMER EMPOWERMENT CHAMPIONS", party:"GOP", pop:7,
    demo:{male:"61%",medAge:58,nonwhite:"8%",hhi:"$105K",college:"44%",rural:"14%",cenDiv:"South Atlantic",cenPct:"25%",pharmaTrust:3.57,corpTrust:3.79,govtTrust:4.07,m4a:"22%",vaxAvoid:"18%"},
    persona:{quote:"Prices are too high and we need reform. We don't need more government programs—we need to empower consumers with transparency and choice.",
      believe:"They believe America’s health care system is broken, riddled with middlemen, hidden costs, and corporate profiteering,  but that government expansion would only make it worse. They are convinced that competition, transparency, and consumer empowerment are the real answers. They think patients should be able to shop for care the way they shop for anything else.",
      want:"They want health care reform not by handing control to Washington, but by forcing insurers and providers to compete, publish prices, and give consumers real choices. They support employer-based coverage, portability of medical records, and “right to try” policies that give patients leverage. Their demand is for a system that works for consumers rather than for corporations or bureaucracies.",
      doWhat:"They are less likely than other Republicans to avoid vaccines and more likely to trust hospitals and providers. They lean toward mainstream care, but insist on transparency and accountability. They gravitate toward Fox and the Wall Street Journal, and their civic participation tends to come through voting and voicing reform-minded skepticism, not through lifestyle movements like wellness evangelism or anti-vax activism.",
      whoAre:"Older (median age ~58), affluent (household income ~$105k), white, married, and more male-skewed. They are suburban and stable-rural, but not economically precarious. They are long-standing Republicans who see themselves as fixers rather than burn-it-down populists. Angry at the system, but constructive in how they want to change it."}},
  { id:3, code:"TC", name:"TRADITIONAL CONSERVATIVES", party:"GOP", pop:6,
    demo:{male:"68%",medAge:58,nonwhite:"12%",hhi:"$113K",college:"64%",rural:"11%",cenDiv:"East North Central",cenPct:"20%",pharmaTrust:3.94,corpTrust:4.01,govtTrust:4.04,m4a:"17%",vaxAvoid:"29%"},
    persona:{quote:"A strong America means limited government that defends the family, while ensuring healthcare is driven by the free market—not ideology.",
      believe:"They believe America works best when government is limited, families are strong, and individuals take responsibility for themselves and their communities. They see cultural change on the left --particularly around gender, family, and social norms --as having spilled into healthcare and distorted its priorities.",
      want:"They want healthcare policy to reinforce responsibility and stability, not what they perceive as “woke” experiments. They favor employer-based coverage, competition, and private solutions, while backing conscience protections for providers and opposing mandates they see as government overreach.",
      doWhat:"They reliably back Republican leaders and advocacy groups that fight cultural progressivism in healthcare. They elevate issues such as restrictions on gender-transition care for minors, limits on abortion services, and opposition to ESG/DEI frameworks in health companies. They also support incremental reforms that strengthen transparency and accountability without dismantling existing insurance structures.",
      whoAre:"Median age ~58, predominantly white, married, and religiously observant (high evangelical and Catholic presence). Financially stable but not affluent, clustered in rural and exurban areas. They are consistent Republican identifiers who see themselves as cultural guardians as much as policy advocates."}},
  { id:4, code:"WE", name:"WELLNESS EVANGELISTS", party:"GOP", pop:9,
    demo:{male:"54%",medAge:59,nonwhite:"11%",hhi:"$98K",college:"52%",rural:"17%",cenDiv:"South Atlantic",cenPct:"23%",pharmaTrust:3.11,corpTrust:3.52,govtTrust:3.57,m4a:"14%",vaxAvoid:"29%"},
    persona:{quote:"I believe in small government that defends traditional values and makes America healthy again through clean food and natural living.",
      believe:"They believe America has been weakened by corrupt elites—corporate and government elites— who profit from dependency and sickness. They see health as something earned through discipline and responsibility, not pills or handouts. Their philosophy is wellness as patriotism: if Americans reclaim their health, families, and responsibilities, the nation itself will be strong again.",
      want:"They want to break the power of corporations and government institutions that they see as profiting from decline. They demand accountability for Big Pharma, recognition of natural medicine, and policies that reward responsibility over dependency. They strongly support Medicaid work requirements and oppose expansions they see as enabling dependency. They want policy that reinforces their core values: health, self-reliance, family, and freedom.",
      doWhat:"Many are self-employed, homeschool their children, and live their wellness values daily: organic food, supplements, home remedies, and fitness. Politically, they are deeply engaged in MAGA networks, participating in rallies, Facebook groups, and alternative media. They consume a mix of populist politics (Bannon, Daily Wire) and wellness/medical freedom podcasts.",
      whoAre:"Largest segment in the MAHA cluster (~20%), porous into neighboring MAGA identities. Middle-aged, modest to middle income, suburban or exurban, often mothers who homeschool their children. They distrust schools, hospitals, and mainstream culture. Politically, they see Trump and MAGA as a movement to defend families from elites who profit by keeping Americans weak and dependent."}},
  { id:5, code:"PP", name:"PRICE POPULISTS", party:"GOP", pop:3,
    demo:{male:"39%",medAge:54,nonwhite:"12%",hhi:"$86K",college:"52%",rural:"10%",cenDiv:"Mountain",cenPct:"13%",pharmaTrust:3.07,corpTrust:3.39,govtTrust:4.07,m4a:"29%",vaxAvoid:"28%"},
    persona:{quote:"Drug and hospital prices are crushing people. I don't care who fixes it, or how—just bring costs down.",
      believe:"They believe the healthcare system is broken because of unchecked corporate greed. High drug and hospital prices are crushing ordinary families, and corporations are profiting at the expense of workers. Unlike free-market conservatives, they don’t care who fixes it—government or private actors—so long as someone brings costs down and defends working people.",
      want:"They want aggressive action to rein in costs. That means cracking down on drug pricing, protecting union health plans, supporting rural hospitals, and resisting privatization schemes that threaten benefits. They are suspicious of both Big Pharma and hospital corporations, but they see government intervention as legitimate if it delivers relief to their families and communities.",
      doWhat:"They are politically active: leading union locals, attending rallies, calling into radio shows, and mobilizing coworkers. Many were lifelong Democrats—loyal to union traditions—and proudly voted for Obama. But after 2008, disillusionment set in as jobs vanished, costs rose, and Democrats looked “too close to Wall Street.” They gravitated toward Trump and MAGA, drawn by his populist attacks on elites.",
      whoAre:"Median age mid-50s, often union households, white but with a notable Hispanic presence. Economically less secure than other GOP groups, concentrated in rural and small-town America. Many work in trades or service industries. Religiosity is present but not central. Politically, they are hardline populists: strong Trump supporters because he speaks their anger, but their loyalty is issue-based—they will turn on leaders if they fail to deliver against corporate interests."}},
  { id:6, code:"HF", name:"HEALTH FUTURISTS", party:"GOP", pop:2,
    demo:{male:"61%",medAge:46,nonwhite:"28%",hhi:"$81K",college:"52%",rural:"4%",cenDiv:"Pacific",cenPct:"17%",pharmaTrust:3.67,corpTrust:4.05,govtTrust:4.16,m4a:"47%",vaxAvoid:"30%"},
    persona:{quote:"Gene therapies, AI, and big data can revolutionize health. Let's embrace innovation boldly—so everyone benefits.",
      believe:"They believe America’s survival depends on leading the next wave of science and technology. For them, innovation is national security: whoever controls AI, gene editing, and biomedical breakthroughs will control the world. They see regulation, bureaucracy, and global treaties as obstacles designed to slow America down while rivals like China race ahead. They are deeply distrustful of “legacy institutions” (NIH, FDA, WHO) but not hostile to science itself—they see science as the battlefield of the 21st century.",
      want:"They want government to unleash innovation—to fuel bold R&D, cut red tape, and give patients and entrepreneurs more freedom to experiment. They want right-to-try expanded, FDA approvals accelerated, and NIH money steered into frontier technologies. They want America to win the innovation race against China and globalists, even if that means breaking old rules.",
      doWhat:"They are highly active online—podcast listeners, Substack subscribers, Twitter/X junkies. They follow biohackers, futurist thinkers, MAGA-friendly technologists, and contrarian doctors. They invest in crypto, wear continuous glucose monitors, take nootropics, and talk about healthspan as much as lifespan. Politically, they are MAGA-adjacent but not traditional conservatives: they’re impatient with “culture war nostalgia” and more animated by a sense of destiny—America as the world’s techno-frontier.",
      whoAre:"Median age late 30s to early 40s, male-skewed, higher income, urban/suburban professionals and entrepreneurs. Some are former libertarians drawn into MAGA because Trump’s anti-bureaucratic, anti-China rhetoric aligned with their worldview. They are multi-layered because they are both fiercely individualistic (personal optimization, biohacking) and intensely nationalistic (America must dominate the future of science)."}},
  { id:7, code:"PFF", name:"PALEO FREEDOM FIGHTERS", party:"GOP", pop:4,
    demo:{male:"48%",medAge:55,nonwhite:"16%",hhi:"$90K",college:"39%",rural:"16%",cenDiv:"Pacific",cenPct:"16%",pharmaTrust:2.75,corpTrust:3.24,govtTrust:3.32,m4a:"27%",vaxAvoid:"41%"},
    persona:{quote:"Don't trust the system. Don't submit to mandates. Don't believe mainstream science. Do your own research.",
      believe:"They believe the American people are being intentionally misled about health — poisoned by bad science, processed food, and corrupted institutions. Strength and truth come from rejecting elites, doing your own research and living by ancestral wisdom: meat, discipline, resilience. They are not shy about it: they see themselves as truth-tellers in a world of followers.",
      want:"They want freedom to live outside the system — to eat clean, train hard, reject mandates — without interference. They want leaders who will expose lies, call out bigc orporations, and affirm their conviction that elites profit by keeping Americans weak. They are suspicious of most public health and international institutions—advocating for withdrawal from the WHO. They also support pro-natal policy.",
      doWhat:"They consume and amplify populist wellness and political media. They are voracious content sharers on Facebook, Telegram, X. They listen to Joe Rogan, Shawn Baker, Paul Saladino, and Jordan Peterson, then repeat those arguments at local gyms, in homeschooling groups, or online. They watch Tucker clips, Daily Wire podcasts, Bongino— and mix them with fluoride warnings or carnivore diet tips. They aren’t passive voters; they’re media multipliers.",
      whoAre:"More female than male, less white than many GOP segments, with a notable Hispanic presence. They atr in midlife, suburban/exurban, and middle-income. Politically MAGA, but in a sharper, more conspiratorial register than Wellness Evangelists. They are the biggest consumers and producers of new media and are top influencers among the MAHA groups — not just listeners, but evangelists spreading content through their networks."}},
  { id:8, code:"HHN", name:"HOLISTIC HEALTH NATURALISTS", party:"GOP", pop:3,
    demo:{male:"46%",medAge:44,nonwhite:"17%",hhi:"$73K",college:"32%",rural:"17%",cenDiv:"South Atlantic",cenPct:"29%",pharmaTrust:3.28,corpTrust:3.48,govtTrust:3.77,m4a:"41%",vaxAvoid:"42%"},
    persona:{quote:"Modern medicine ignores the whole person and natural order. Natural and alternative therapies deserve equal respect and coverage.",
      believe:"They believe modern medicine ignores the whole person. True health comes from nature—clean food, herbs, supplements, and spiritual balance. They see the pharmaceutical industry as corrupt and oriented toward profit, not healing. They are skeptical of vaccines and mainstream dietary guidelines, convinced these systems don’t respect natural remedies or wellness traditions.",
      want:"They want healthcare and society to recognize and respect natural and alternative therapies. They want more transparency about chemicals, GMOs, and processed foods. They want freedom to choose natural approaches without being shamed or coerced into mainstream treatments.",
      doWhat:"They grow their own food, shop organic, practice yoga and meditation, trade herbal remedies, and build online wellness communities. Politically, they are newcomers to the GOP coalition—some voting Republican for the first time in 2016 or even 2020. They were drawn in by RFK Jr.’s crusades against vaccines and corporate medicine, and then pulled deeper into MAGA networks where anti-establishment energy aligns with their lifestyle ethos.",
      whoAre:"More female than male, younger than Wellness Evangelists, and more racially diverse. Median age early-to-mid 40s. Urban and suburban as much as exurban. Many are ex-Democrats or independents who once marched for climate justice or food purity, but now see Democrats as captured by corporate and “woke” elites. They are porous: some still vote left on environmental issues, but many are drifting right, pulled in through vaccine skepticism, medical freedom, and MAGA populism."}},
  { id:9, code:"MFL", name:"MEDICAL FREEDOM LIBERTARIANS", party:"GOP", pop:5,
    demo:{male:"46%",medAge:55,nonwhite:"12%",hhi:"$96K",college:"36%",rural:"9%",cenDiv:"South Atlantic",cenPct:"27%",pharmaTrust:2.88,corpTrust:3.32,govtTrust:3.65,m4a:"26%",vaxAvoid:"35%"},
    persona:{quote:"My body, my choice—whether mandates, supplements, or experimental drugs, I want minimal government involvement.",
      believe:"They believe health is about liberty and personal responsibility. COVID and vaccine mandates radicalized them, but they are reverting to a long-standing libertarian instinct: government should butt out of private health choices. Their philosophy is civil libertarian, not economic libertarian. They aren’t free-market crusaders like the Reformers, nor conspiracy-driven like the Absolutists. Instead, they believe patients—not corporations or bureaucrats—should decide what goes into their bodies.",
      want:"They want to preserve personal autonomy in healthcare. That means: the right to refuse vaccines and mandates, the right to access supplements and alternative therapies, and the right to try experimental drugs. They are strong supporters of Medicaid work requirements but not wholesale safety-net cutters—their emphasis is responsibility, not elimination. They want transparency about pharma and medical data, not handouts.",
      doWhat:"They use supplements heavily, and lean into organic/clean food practices (but less than Naturalists). They consume libertarian-leaning media: Rogan, Megyn Kelly, Jordan Peterson, Daily Wire, with less reliance on Bannon or hard MAGA pods. They are less extreme and distrustful than Paleo Freedom Fighters, framing themselves as “live and let live” liberty activists.",
      whoAre:"Median age 55, more female than male, disproportionately married with kids. White but with some Hispanic representation. Mostly suburban and rural. Demographically stable, incomes around $95k (above Price Populists, below Free Market Reformers). Many were politically disengaged or even “normies” before COVID, but mandates radicalized them into activism. They are porous: able to align with mainstream libertarians, with wellness influencers, or with MAGA populists depending on context."}},
  { id:10, code:"VS", name:"VACCINE SKEPTICS", party:"GOP", pop:5,
    demo:{male:"48%",medAge:52,nonwhite:"8%",hhi:"$84K",college:"29%",rural:"16%",cenDiv:"East South Central",cenPct:"10%",pharmaTrust:2.3,corpTrust:2.78,govtTrust:3.07,m4a:"24%",vaxAvoid:"45%"},
    persona:{quote:"I am opposed to vaccines and mandates and don't trust government or pharmaceutical companies.",
      believe:"They believe vaccines are unsafe, ineffective, and part of a broader system of coercion and corruption. They view mandates as tyranny and believe the medical establishment hides the truth about harms. They are deeply suspicious of public health authorities, Big Pharma, and government, often tying vaccine skepticism to wider conspiracies about global control.",
      want:"They want total freedom from mandates, transparency about vaccine risks (as they perceive them), and accountability for what they see as lies and cover-ups. They want space to raise children without immunization requirements, to refuse vaccines without penalty, and to dismantle the power of organizations like the CDC, FDA, and WHO.",
      doWhat:"They organize rallies, attend alternative health summits, and flood social media with anti-vaccine content. They follow high-profile contrarian doctors and activists (Del Bigtree, Sherri Tenpenny, RFK Jr., Simone Gold). They homeschool or place children in communities that allow exemptions. Politically, they align with MAGA because Trump and his allies validated their distrust of institutions—even though Trump himself occasionally touts vaccines, which remains a tension point.",
      whoAre:"Predominantly middle-aged, rural or exurban, white, with both male and female representation. Many are working-class or homemakers with a high share of homeschooling families. They are less economically defined than Price Populists—their identity is almost entirely ideological and cultural. They represent the most extreme, least porous group in the GOP model: once inside, they rarely move, but they also have little overlap with moderates or institutional conservatives."}},
  { id:11, code:"UCP", name:"UNIVERSAL CARE PROGRESSIVES", party:"DEM", pop:11,
    demo:{male:"35%",medAge:46,nonwhite:"35%",hhi:"$96K",college:"54%",rural:"13%",cenDiv:"Mountain",cenPct:"15%",pharmaTrust:2.06,corpTrust:2.51,govtTrust:4.52,m4a:"82%",vaxAvoid:"4%"},
    persona:{quote:"Health care is a human right. It's time for universal health care. We need Medicare-for-All.",
      believe:"They believe healthcare is a fundamental human right, not a benefit tied to employment, age, or income. In their view, the American healthcare system is not merely inefficient or unfair — it is structurally unfair. They see corporate power — insurers, pharmaceutical companies, hospital chains — as the central driver of high costs, inequity, and denial of care. Incremental reforms, in their view, do not fix the problem; they normalize a broken moral framework. For them, universality is not a policy preference but a legitimacy test: either everyone is covered, or the system has failed.",
      want:"They want Medicare-for-All or something functionally equivalent: a single, universal system that guarantees comprehensive coverage, eliminates private insurance middlemen, and uses public bargaining power to control prices. They support aggressive drug-price negotiation, global budgets for hospitals, and strict limits on corporate profiteering. They strongly support reproductive freedom, gender-affirming care, and equity mandates, and they believe healthcare policy must explicitly confront inequality, not merely reduce costs. They are willing to accept disruption, higher taxes, and political conflict if those are the price of achieving universal coverage. For them, the risk of not acting is greater than the risk of change.",
      doWhat:"They mobilize. They organize rallies, canvass for progressive candidates, pressure Democratic leadership, and elevate healthcare as a moral litmus test in elections. They share patient stories, policy explainers, and critiques of corporate healthcare power online, and they are vocal critics of politicians who hedge, compromise, or delay. They are skeptical of experts who defend the status quo and dismiss warnings about “implementation risk” as excuses for inaction. Their politics are confrontational not because they enjoy conflict, but because they believe moral clarity requires it.",
      whoAre:"Median age late 40s to early 50s, racially diverse, urban and inner-suburban. Highly educated but economically mixed — many work in nonprofit, education, healthcare, advocacy, or creative fields. Politically progressive and reliably Democratic, but often frustrated with party leadership, which they see as too cautious and too close to corporate interests. They are secular in tone, justice-driven rather than institution-protective, and impatient with gradualism."}},
  { id:12, code:"FJP", name:"FAITH & JUSTICE PROGRESSIVES", party:"DEM", pop:10,
    demo:{male:"29%",medAge:44,nonwhite:"57%",hhi:"$74K",college:"44%",rural:"11%",cenDiv:"South Atlantic",cenPct:"21%",pharmaTrust:4.02,corpTrust:4.11,govtTrust:5.12,m4a:"59%",vaxAvoid:"13%"},
    persona:{quote:"My faith calls me to fight for justice. Racism and inequality drive poor health. Health equity must be a top priority.",
      believe:"They see health as a moral ecosystem—families, congregations, clinics, and public institutions each bearing obligations to the vulnerable. Science is a public good that merits funding and careful guardrails: invest in discovery, demand transparency, and regulate powerful tools (AI, biologics) without choking off cures. Corporate power in health care is viewed skeptically (particularly pharma’s profits and patent games), but they are not anti-medicine; they want institutions to serve patients first. Conscience and family matter: clinicians shouldn’t be compelled to violate core beliefs, adults should have access to gender-affirming care while irreversible interventions for minors face age safeguards, and government can legitimately support marriage and child-rearing. Justice requires tackling social drivers of health and remedying historic inequities in communities of color, all while keeping hospitals—especially rural ones—open and viable.",
      want:"They want bigger bets on science (higher NIH/CDC budgets), tighter oversight where it counts (drug-price negotiation, strong AI-in-medicine rules, data portability, and curbs on patent abuse), and faster compassionate access (right-to-try/early access after Phase I with robust real-world evidence). They prioritize community mental-health funding—and support carefully structured mandated treatment for severely ill unhoused individuals—plus GMO warning labels and employer coverage requirements. They favor a public option alongside Medicare Advantage protection, Medicaid safeguards, and rural-hospital subsidies, and they back immigration and trade policies that protect U.S. health-care workers. Pandemic policy should be evidence-led, not reflexively “natural immunity only.”",
      doWhat:"They blend everyday wellness with faith practice. Many take supplements, read labels, use fitness trackers, go to the gym, and pray or meditate regularly. A notable minority try alternative therapies and share health content online. They are civically present through churches, schools, and local nonprofits, and they’re the folks who show up when a parishioner needs meals, a ride to chemo, or help navigating an insurance denial.",
      whoAre:"Predominantly female (~71%), mean age mid-50s (~54), and the most racially diverse cohort in the left-of-center universe (~59% White, ~29% Black, meaningful Hispanic representation). Largely suburban (~57%) with a strong urban (~34%) presence. Education tilts college-plus (~34% BA, ~20% grad), incomes cluster in the broad middle to upper-middle ranges, and coverage is led by employer insurance (~43%) with visible shares in Medicare Advantage (~18%), Medicaid (~15%), and individual plans (~12%). Religiously engaged—especially Protestant (~34%) and Catholic (~25%)—with observance spread from sporadic to regular; they’re proud of the country yet want institutions to better reflect faith, family, and fairness."}},
  { id:13, code:"HCP", name:"HEALTH CARE PROTECTIONISTS", party:"DEM", pop:8,
    demo:{male:"31%",medAge:47,nonwhite:"40%",hhi:"$81K",college:"53%",rural:"14%",cenDiv:"Pacific",cenPct:"24%",pharmaTrust:2.3,corpTrust:2.83,govtTrust:3.78,m4a:"40%",vaxAvoid:"13%"},
    persona:{quote:"Unions fought for good coverage, and we should protect those benefits, while restraining corporate excess.",
      believe:"They believe healthcare legitimacy is rooted in work, contribution, and earned benefits. Coverage is not an abstract right or a technocratic system — it is something working people fought for, bargained for, and built over decades. They are deeply skeptical of both corporate power and distant bureaucracy. To them, Big Pharma, hospital chains, insurers, and Washington regulators all sit too far from the people who actually pay the price when systems fail. They believe reform efforts too often protect elites — executives, consultants, or policymakers — while asking workers to absorb the disruption.",
      want:"They want affordable care that protects existing coverage and American jobs. Their first instinct is defensive: don’t take away what workers already have. They support cracking down on price-gouging, surprise billing, junk fees, and corporate profiteering — especially when it raises costs for families with employer-sponsored insurance. They want policy that strengthens collective bargaining, protects union health plans, keeps hospitals open in working communities, and reins in corporate consolidation. They are open to government intervention when it clearly lowers costs or stabilizes access, but they strongly oppose reforms that threaten employer-based coverage, weaken negotiated benefits, or hand more power to unaccountable bureaucracies.",
      doWhat:"They organize, vote, and mobilize through labor networks, community groups, and workplace politics. They show up at town halls, pressure employers and lawmakers, and talk about healthcare in concrete terms: premiums, deductibles, prescription prices, and whether the local hospital stays open. They are not especially deferential to experts. They trust common sense over white papers and are quick to challenge reforms that sound elegant but feel disconnected from working-class reality. Their politics are confrontational when necessary, but grounded in protection rather than revolution.",
      whoAre:"Median age mid-to-late 50s, economically mixed but often financially stretched. Disproportionately union households or workers in trades, manufacturing, transportation, utilities, and service sectors. More rural and small-town than urban. Racially diverse within the working class. They are not ideologues. They are guardians of hard-won benefits.."}},
  { id:14, code:"HAD", name:"HEALTH ABUNDANCE DEMOCRATS", party:"DEM", pop:8,
    demo:{male:"54%",medAge:48,nonwhite:"48%",hhi:"$85K",college:"52%",rural:"9%",cenDiv:"South Atlantic",cenPct:"31%",pharmaTrust:4.16,corpTrust:4.12,govtTrust:4.85,m4a:"51%",vaxAvoid:"10%"},
    persona:{quote:"Digital tools, AI, and start-ups can universalize care faster than big bureaucracies—let's remove red tape.",
      believe:"They see America’s health crisis as a supply-and-access problem that demands more of everything that works—more clinicians, more primary care, more mental-health capacity, more affordable coverage, and faster pathways from lab to patient. Government is a partner, not a savior: regulate where it matters, fund discovery, require employer responsibility, and give consumers real power over data and choice. They are pro-science with guardrails—comfortable with early access and post-market evidence, but insistent that AI diagnostics be regulated like medical devices and that clinical research be transparent. Culturally they are center-left populists: proud of the country, more traditional on family questions than other Democrats, skeptical of corporate “woke” branding, and keen on protecting American workers in trade and immigration policy. They distrust corporate power in health care—especially pharma’s profits and patent games—yet they’re not anti-business; they want markets that serve patients.",
      want:"They want capacity and affordability built at once: protect Medicaid and Medicare Advantage, require large employers to offer coverage, and add a public option to discipline prices. Let Medicare negotiate drug prices, curb patent abuse, and give patients data portability and data ownership rights. Fund NIH/CDC while accelerating access—early/compassionate use after Phase I, with real-world evidence to confirm benefit. Put real money into community mental-health and addiction care, allow mandated treatment for the severely ill unhoused when necessary and humane, and keep rural hospitals open with targeted subsidies. Label GMOs, regulate AI in medicine strictly, and offer wellness discounts in insurance. On hot-button issues they split the difference: cover gender-affirming care for adults, but restrict irreversible procedures for minors; respect patient autonomy and clinician conscience while avoiding blanket “natural-immunity-only” rules in future pandemics.",
      doWhat:"Day to day they practice mainstream wellness without the fads. Majorities take supplements and read labels; many use fitness trackers and go to the gym; a smaller share tries complementary therapies. They’re not heavy influencers online, but they do share health tips occasionally. At work they navigate employer benefits, price-shop for care, and expect seamless digital access to their records. Politically they show up for practical fixes—bond issues for hospital expansions, school-based counseling, workforce initiatives that train nurses and community health workers.",
      whoAre:"Female-leaning (≈64%), median age mid-50s, highly college-educated (≈64% BA+), and suburban-urban (≈57% suburban, ≈30% urban). Racially they are mostly White (~78%) with meaningful Asian (~6%) and Hispanic (~8%) presence. Insurance skews employer coverage (~54%) with additional Medicaid (~11%), Medicare Advantage (~9%), and individual-market (~12%) enrollment. A quarter report union ties (~26%). Religiously they are the least churched of the Democratic clusters (large atheist/agnostic/“nothing in particular” share), yet they score proud to be American and lean worker-protection on trade and immigration. Nearly half think the U.S. is less healthy than peer nations, which fuels their urgency for capacity-building and reform."}},
  { id:15, code:"HCI", name:"HEALTH CARE INCREMENTALISTS", party:"DEM", pop:7,
    demo:{male:"44%",medAge:55,nonwhite:"44%",hhi:"$104K",college:"62%",rural:"8%",cenDiv:"Pacific",cenPct:"33%",pharmaTrust:4.09,corpTrust:4.17,govtTrust:5.02,m4a:"36%",vaxAvoid:"7%"},
    persona:{quote:"I prefer step-by-step reforms. That means strengthening the ACA, not abandoning it.",
      believe:"They believe healthcare should be dependable, fair, and earned through participation in society over a lifetime. The system does not need to be torn down — it needs to work consistently for people who have planned, paid in, and now depend on it. They believe experts matter, institutions matter, and evidence matters — but only insofar as those institutions deliver predictability and protection. They are deeply skeptical of sweeping reforms that put coverage, benefits, or access at risk, especially for older Americans who cannot “wait it out” if something goes wrong. Their defining belief is not ideology, but risk intolerance: healthcare policy should never gamble with people’s security.",
      want:"They want to protect and improve what people already rely on — Medicare, Medicare Advantage, prescription drug coverage, and ACA protections for older and near-retirement Americans. They support closing gaps, lowering out-of-pocket costs, and negotiating drug prices, but strongly oppose reforms that threaten continuity of care or destabilize coverage. They favor incremental expansion, careful pilots, and reforms that can be reversed if they fail. They want technology used to simplify care and reduce cost, but only when privacy, fairness, and oversight are guaranteed. Their instinct is always: prove it works before you scale it.",
      doWhat:"They vote at extremely high rates, contact lawmakers, respond to policy alerts, and engage through trusted membership organizations rather than protests. They follow healthcare debates closely, read explainers, and ask pointed questions about implementation, transition risk, and unintended consequences.",
      whoAre:"Median age late 60s, but spanning late-50s pre-retirees through older seniors. Predominantly suburban, mixed income but risk-averse, with fixed or semi-fixed incomes. United by a strong sense of entitlement to stability after a lifetime of work. They are not activists. They are stakeholders."}},
  { id:16, code:"GHI", name:"GLOBAL HEALTH INSTITUTIONALISTS", party:"DEM", pop:10,
    demo:{male:"41%",medAge:57,nonwhite:"24%",hhi:"$95K",college:"63%",rural:"10%",cenDiv:"Mid Atlantic",cenPct:"15%",pharmaTrust:4.54,corpTrust:4.31,govtTrust:5.66,m4a:"67%",vaxAvoid:"6%"},
    persona:{quote:"America is better off as a leader in the global economy. To lead, we need to innovate to solve our biggest health threats.",
      believe:"They believe climate change is the single most important health challenge of the 21st century — the force multiplier that worsens nearly every other health risk. Because climate-driven health threats do not respect borders, they believe modern health challenges are fundamentally global and institutional. Pandemics, supply-chain disruptions, antimicrobial resistance, and emerging technologies cannot be managed by markets or nations acting alone. Only coordinated expert institutions — domestic and international — have the scale, continuity, and authority required to respond effectively.",
      want:"They want the United States to support a robust global health system. That means sustained funding for NIH, CDC, FDA, and strong engagement with international bodies like the WHO and global research consortia. They support drug-price oversight and guardrails, but oppose blunt policies that would undermine biomedical innovation or private-sector participation. They want expert-driven regulation, predictable rules for industry, global standards for safety and data, and coordinated pandemic preparedness. They favor expanding access and affordability through institutional reform — not through dismantling private insurance or replacing the system wholesale.",
      doWhat:"They vaccinate, follow public-health guidance, and rely on mainstream medical care. They defend expert agencies during crises, push back on populist attacks against science, and advocate for policy solutions that preserve institutional continuity. They participate in policy debates through professional networks, advisory roles, NGOs, and industry-government partnerships rather than street-level activism. They are more likely to argue for “fixing governance” than for moral confrontation, and more likely to warn about unintended consequences than to celebrate disruption.",
      whoAre:"Slightly younger and highly educated, urban or close-in suburban. Many work in policy, academia, or international development. Politically center-left, institutionally loyal, and culturally liberal on issues like reproductive freedom and climate change, but cautious about sweeping structural overhauls. They are comfortable with complexity and allergic to ideological absolutism."}},
];

// ─── ADDITIONAL DEMOGRAPHIC DATA ─── (indexed by segment order)
// Order: TSP, CEC, TC, WE, PP, HF, PFF, HHN, MFL, VS, UCP, FJP, HCP, HAD, HCI, GHI
const MILITARY = [12.3, 12.6, 10.2, 18.0, 9.8, 7.5, 9.7, 9.0, 9.2, 4.0, 4.8, 3.4, 5.1, 4.6, 8.8, 5.7];
const UNION_HH = [6.2, 16.6, 19.5, 17.8, 9.3, 20.6, 17.6, 15.3, 16.1, 14.0, 25.8, 19.0, 22.6, 16.3, 15.1, 21.9];

const RELIGION_CATS = [
  { label:"White Evangelical", key:"wEvan" },
  { label:"Black Protestant", key:"bProt" },
  { label:"White Mainline", key:"wMain" },
  { label:"Catholic", key:"cath" },
  { label:"Jewish", key:"jew" },
  { label:"Other", key:"other" },
  { label:"None", key:"none" },
];

// data[segIdx] for each religion
const RELIGION_DATA = {
  wEvan: [26.0, 7.3, 22.2, 35.8, 15.7, 20.6, 28.5, 16.8, 12.4, 15.3, 1.4, 5.2, 3.2, 7.4, 3.7, 3.8],
  bProt: [0.0, 0.0, 0.5, 0.3, 0.0, 2.2, 2.7, 2.9, 1.5, 0.5, 3.6, 13.2, 3.5, 7.1, 5.1, 3.3],
  wMain: [15.2, 22.8, 18.0, 13.2, 21.4, 8.7, 9.9, 18.6, 17.3, 15.5, 5.9, 8.5, 10.4, 6.0, 10.8, 15.7],
  cath:  [21.4, 28.2, 31.1, 23.0, 28.4, 31.7, 23.4, 26.4, 24.9, 26.5, 10.8, 24.3, 24.6, 23.6, 23.2, 16.3],
  jew:   [3.9, 4.9, 3.0, 1.1, 0.2, 0.0, 2.7, 1.7, 4.8, 2.9, 4.1, 1.0, 2.6, 4.4, 2.9, 8.4],
  other: [27.2, 13.5, 14.5, 21.5, 13.3, 24.6, 22.5, 16.5, 13.5, 16.6, 13.1, 28.0, 19.3, 28.3, 15.7, 10.3],
  none:  [6.3, 23.2, 10.6, 5.2, 21.0, 12.2, 10.4, 17.0, 25.6, 22.7, 61.2, 19.9, 36.3, 23.1, 38.6, 42.1],
};

// Overindex markers (X) — segment indices where overindexed
const RELIGION_OVERINDEX = {
  wEvan: [3,6],        // WE, PFF
  bProt: [11],         // FJP
  wMain: [1],          // CEC
  cath:  [2,4,5,7,8,9],// TC, PP, HF, HHN, MFL, VS
  jew:   [],
  other: [0,13],       // TSP, HAD
  none:  [10,12,14,15],// UCP, HCP, HCI, GHI
};

// ─── PRE/POST DATA (HIV: 7 items per segment) ───
// ─── VECTOR DATA ───
// ─── STUDY-SPECIFIC ROI DATA (HIV) ───
// HIV study metrics. Tier always sourced from getAssignedTier(code) — analyst-configured in workbook.
// STUDY_ROI was a hardcoded mirror of STUDY_METRICS; deleted in favor
// of reading STUDY_METRICS directly so the segment-profile ROI card
// refreshes with each .sav (same source as /audience-roi).
const STUDY_ROI = Object.fromEntries(
  Object.entries(STUDY_METRICS).map(([code, m]) => [code, { HIV: {
    roi: m.roi, highRoi: m.highRoi, supporters: m.supporters,
    activation: m.activation, influence: m.influence,
  } }])
);

const GOP_VECTORS = {
  TSP: { trust:0.37, science:0.23, autonomy:-0.20, markets:-0.11 },
  CEC: { trust:0.24, science:0.26, autonomy:-0.30, markets:-0.01 },
  TC:  { trust:0.42, science:0.21, autonomy:-0.21, markets:0.29 },
  WE:  { trust:-0.02, science:-0.22, autonomy:0.16, markets:0.24 },
  PP:  { trust:-0.19, science:0.23, autonomy:-0.17, markets:-0.36 },
  HF:  { trust:0.04, science:0.29, autonomy:-0.29, markets:-0.34 },
  PFF: { trust:-0.43, science:-0.43, autonomy:0.41, markets:0.09 },
  HHN: { trust:-0.07, science:0.03, autonomy:-0.03, markets:-0.09 },
  MFL: { trust:-0.20, science:-0.06, autonomy:0.09, markets:-0.12 },
  VS:  { trust:-0.64, science:-0.46, autonomy:0.36, markets:-0.19 },
};
const DEM_VECTORS = {
  UCP: { reform:0.70, equity:0.46, domestic:-0.19, private:-0.53 },
  FJP: { reform:0.06, equity:0.31, domestic:0.16, private:-0.02 },
  HCP: { reform:-0.37, equity:-0.29, domestic:0.33, private:-0.12 },
  GHI: { reform:0.32, equity:0.22, domestic:-0.46, private:0.14 },
  HAD: { reform:-0.24, equity:-0.43, domestic:0.31, private:0.33 },
  HCI: { reform:-0.77, equity:-0.52, domestic:-0.01, private:0.40 },
};
const GOP_AXES = [
  { key:"trust",    pos:"Trust",    neg:"Cynicism" },
  { key:"science",  pos:"Science",  neg:"Purity" },
  { key:"autonomy", pos:"Autonomy", neg:"Public Health" },
  { key:"markets",  pos:"Markets",  neg:"Econ. Populism" },
];
// ─── VECTOR AXIS DEFINITIONS (hover tooltips) ───
const VECTOR_DEFS = {
  trust: {
    title: "TRUST: Cynicism ↔ Trust",
    text: "Measures baseline institutional confidence in the healthcare establishment — federal agencies, medical associations, and credentialed expertise. Higher Trust segments accept guidance from public health authorities as generally reliable, while Cynicism leaning segments perceive these institutions as captured by political or financial interests and filter recommendations accordingly."
  },
  science: {
    title: "SCIENCE: Purity ↔ Science",
    text: "Captures whether a segment embraces evidence-based biomedical interventions or gravitates toward natural remedies, holistic wellness, and bodily purity. Science-oriented segments trust clinical trial evidence and pharmaceutical solutions at face value, while Purity segments view synthetic interventions with skepticism and prioritize organic, minimally processed alternatives."
  },
  autonomy: {
    title: "AUTONOMY: Public Health ↔ Body Autonomy",
    text: "Reveals the tension between collective health mandates and individual sovereignty over medical decisions. Public Health oriented segments accept vaccination requirements, masking protocols, and regulatory oversight as legitimate community protections, while Body Autonomy segments view any compulsory health measure as an unacceptable infringement on personal liberty."
  },
  markets: {
    title: "MARKETS: Economic Populism ↔ Free Markets",
    text: "Distinguishes between segments that trust market competition to optimize healthcare pricing and access versus those demanding government intervention to control costs. Free Market segments favor deregulation, consumer choice, and innovation incentives, while Economic Populist segments want aggressive price controls, trade policy enforcement, and protecting access to care."
  },
  reform: {
    title: "REFORM: Status Quo ↔ System Reform",
    text: "Measures how aggressively a segment wants to restructure the U.S. healthcare system, from single-payer transformation to working within existing frameworks. Segments scoring toward Reform see the current architecture as fundamentally broken, while those toward Status Quo believe targeted policy fixes can deliver meaningful progress without systemic disruption."
  },
  equity: {
    title: "JUSTICE: Individualism ↔ Justice",
    text: "Measures whether a segment frames healthcare outcomes primarily as a product of structural inequities or personal choices and accountability. Justice-focused segments prioritize closing disparate access gaps across race, income, and geography, while Individual Responsibility segments emphasize personal health behaviors and merit-based resource allocation."
  },
  domestic: {
    title: "LEADERSHIP: Global Focus ↔ American Leadership",
    text: "Reveals whether a segment sees U.S. healthcare policy through an internationalist lens or a nationalist one. Global Health segments see the top threats to health coming from global pandemics and climate change, and support multilateral cooperation. American healthcare leadership looks to the U.S. to set the global standard through domestic innovation and competitive excellence."
  },
  private: {
    title: "INDUSTRY: Public Sector ↔ Private Industry",
    text: "Gauges posture toward pharmaceutical companies, insurers, and other corporate actors in the healthcare ecosystem. Segments on the Public Sector end view industry profit motives as incompatible with patient welfare, while those at the Industry end see private-sector innovation and capital as essential engines of progress."
  },
};

const DEM_AXES = [
  { key:"reform",   pos:"Reform",   neg:"Status Quo" },
  { key:"equity",   pos:"Justice",  neg:"Individualism" },
  { key:"domestic", pos:"Leader",   neg:"Global Focus" },
  { key:"private",  pos:"Industry", neg:"Public Sector" },
];

// ─── IDEOLOGY DATA ───
const IDEOLOGY_GROUPS = [
  { label:"MARKETS", color:"#34d399", dims:[
    { key:"regulation", label:"Regulation",   lo:"Necessary",       hi:"Harmful" },
    { key:"sizeofgovt", label:"Size of Govt", lo:"Do more",         hi:"Spends too much" },
    { key:"profit",     label:"Profit",       lo:"Too much profit", hi:"Fair profit" },
  ]},
  { label:"MFA", color:"#f59e0b", dims:[
    { key:"mfa", label:"Health Care", lo:"Right / public system", hi:"Private market" },
  ]},
  { label:"PLANET", color:"#60a5fa", dims:[
    { key:"enviro",  label:"Environment",    lo:"Protect",        hi:"Gone too far" },
    { key:"climate", label:"Climate Change", lo:"Serious threat", hi:"Overblown" },
  ]},
  { label:"MORALITY", color:"#c084fc", dims:[
    { key:"homosexuals", label:"Homosexuality",   lo:"Acceptance",  hi:"Discouragement" },
    { key:"familystruc", label:"Family Structure", lo:"Diversity",   hi:"Traditional" },
    { key:"abortion",    label:"Abortion",         lo:"Pro-choice",  hi:"Pro-life" },
    { key:"religion",    label:"Religion",         lo:"Without God", hi:"Requires God" },
  ]},
  { label:"POPULISM", color:"#fb7185", dims:[
    { key:"immigration", label:"Immigration", lo:"Strengthens",     hi:"Threatens" },
    { key:"trade",       label:"Trade",       lo:"Free trade",      hi:"Protectionism" },
    { key:"globalism",   label:"Globalism",   lo:"Global leader",   hi:"America First" },
    { key:"patriotism",  label:"Patriotism",  lo:"Not proud",       hi:"Proud" },
    { key:"authority",   label:"Authority",   lo:"Strong measures", hi:"Trust system" },
  ]},
];
const IDEOLOGY_DATA = {
  regulation:  [4.76,4.78,5.28,5.34,4.49,4.08,4.91,4.73,5.26,4.67, 3.49,3.77,4.02,3.93,4.02,3.30],
  sizeofgovt:  [4.17,4.42,5.00,5.01,3.66,3.88,4.53,4.16,4.20,4.09, 2.39,3.17,3.15,3.31,4.02,2.66],
  profit:      [4.31,4.40,4.38,4.15,3.74,4.25,3.65,3.96,4.12,3.80, 3.29,3.62,3.53,3.94,3.84,3.53],
  mfa:         [3.98,4.26,4.42,4.54,3.81,3.40,4.56,4.01,4.06,4.47, 2.26,3.21,3.04,3.29,3.09,2.48],
  enviro:      [4.60,4.71,4.76,5.16,4.24,3.81,4.65,4.52,4.38,4.76, 2.48,3.29,2.85,3.19,2.86,2.28],
  climate:     [5.00,5.29,5.31,5.58,4.69,4.07,4.89,4.56,4.99,4.76, 3.01,3.73,3.97,4.17,3.99,3.49],
  homosexuals: [4.77,4.69,5.33,5.48,4.22,4.27,4.96,4.16,4.23,4.56, 3.00,3.70,3.59,4.35,3.77,2.84],
  familystruc: [4.87,3.43,5.01,5.59,3.75,4.04,4.85,4.54,4.04,4.19, 2.41,3.31,3.12,3.73,3.03,2.23],
  abortion:    [4.42,4.59,4.84,5.05,4.84,4.23,5.14,4.38,4.89,4.69, 2.60,3.07,3.66,3.73,3.39,2.51],
  religion:    [4.59,4.54,4.77,4.31,4.19,3.66,4.26,4.41,4.35,3.73, 3.07,4.17,3.39,3.65,3.14,2.80],
  immigration: [4.95,4.95,5.05,5.30,4.55,4.37,4.88,4.39,5.06,5.22, 2.48,3.14,3.39,3.61,3.43,2.68],
  trade:       [4.71,5.07,4.74,4.94,4.52,4.56,5.05,4.77,4.87,4.97, 3.15,3.86,4.21,4.17,3.53,2.60],
  globalism:   [5.29,5.30,5.45,5.34,4.65,4.35,4.90,5.04,4.92,5.21, 3.24,3.73,4.31,4.17,4.94,3.75],
  patriotism:  [4.48,4.31,4.83,4.62,4.30,3.82,4.45,4.21,4.26,4.35, 3.64,4.10,4.34,4.11,4.31,3.90],
  authority:   [4.75,3.40,4.58,4.95,3.88,3.78,4.82,4.41,3.70,3.83, 2.72,4.11,3.17,3.97,2.93,2.61],
};

// ─── TIER & COLOR CONSTANTS ───
const TIER_BG = {1:"#064e3b",2:"#854d0e",3:"#991b1b"};
const TIER_TEXT = {1:"#6ee7b7",2:"#fde047",3:"#fca5a5"};
const TIER_ACCENT = {1:"#34d399",2:"#eab308",3:"#ef4444"};
const TIER_LABELS = {1:"TIER 1",2:"TIER 2",3:"TIER 3"};


// Color palette
const C = {
  bg:"#080c16", card:"#111620", border:"#1c2433",
  text1:"#dce4ed", text2:"#7b8da3", text3:"#3e4f63",
  accent:"#5b93c7", accentLight:"#7eb3e0",
  ring1:"#5b93c7", ring2:"#1c2433",
  mapActive:"#5b93c7", mapActiveBorder:"#7eb3e0",
  mapIdle:"#151c28", mapIdleBorder:"#222d3d",
};

// ─── US STATE PATHS for geography ───
const STATE_PATHS = {
  "Pacific":[
    "M 78,11 L 78,8 82,7 90,8 96,8 100,11 100,27 93,27 91,22 85,19 80,18 78,15 Z",
    "M 78,18 L 85,19 91,22 93,27 100,27 100,42 82,42 78,35 Z",
    "M 78,35 L 82,42 100,42 100,50 98,58 93,65 88,72 83,75 80,70 78,60 76,50 Z",
    "M 20,75 L 30,72 42,74 48,78 42,82 30,82 22,80 Z",
    "M 55,80 L 58,78 62,79 64,82 60,83 56,82 Z",
  ],
  "Mountain":[
    "M 100,8 L 130,8 148,10 148,25 100,25 Z",
    "M 100,25 L 100,11 96,8 100,25 108,42 100,42 Z",
    "M 108,25 L 148,25 148,40 108,40 Z",
    "M 100,42 L 108,42 108,60 100,65 98,58 100,50 Z",
    "M 108,42 L 128,42 128,60 108,60 Z",
    "M 128,42 L 160,42 160,58 128,58 Z",
    "M 108,60 L 128,60 128,78 108,78 105,72 Z",
    "M 128,60 L 155,60 155,78 128,78 Z",
  ],
  "West North Central":[
    "M 148,10 L 182,10 182,22 148,22 Z",
    "M 148,22 L 182,22 182,35 148,35 Z",
    "M 148,35 L 182,35 185,42 160,42 148,40 Z",
    "M 160,42 L 185,42 185,58 160,58 Z",
    "M 182,8 L 200,8 200,28 182,28 182,10 Z",
    "M 182,28 L 200,28 205,35 200,42 185,42 182,35 Z",
    "M 185,42 L 200,42 210,42 215,48 210,58 200,60 185,58 Z",
  ],
  "East North Central":[
    "M 200,8 L 218,10 222,22 215,28 200,28 Z",
    "M 218,8 L 235,10 240,18 238,28 228,22 222,22 218,10 Z",
    "M 200,28 L 215,28 215,48 210,50 200,42 Z",
    "M 215,28 L 228,28 228,48 215,48 Z",
    "M 228,28 L 245,25 248,38 240,48 228,48 Z",
  ],
  "West South Central":[
    "M 185,58 L 200,60 200,70 185,70 Z",
    "M 185,70 L 200,70 202,78 195,82 185,80 Z",
    "M 155,58 L 185,58 185,68 165,68 155,65 Z",
    "M 128,78 L 155,78 155,65 165,68 185,68 185,80 180,90 170,95 155,95 140,90 130,85 Z",
  ],
  "East South Central":[
    "M 210,42 L 215,48 228,48 240,48 248,42 252,45 245,50 225,52 210,52 Z",
    "M 210,52 L 225,52 245,50 255,52 255,58 210,58 Z",
    "M 200,60 L 210,58 210,75 202,78 200,70 Z",
    "M 210,58 L 225,58 228,75 220,78 210,75 Z",
  ],
  "South Atlantic":[
    "M 262,38 L 265,36 266,40 263,42 Z",
    "M 252,36 L 262,34 265,36 262,38 258,40 252,40 Z",
    "M 240,42 L 255,40 265,42 268,45 258,48 240,48 Z",
    "M 240,38 L 248,38 252,42 248,48 240,48 240,42 Z",
    "M 240,48 L 258,48 270,50 275,52 265,55 240,55 Z",
    "M 240,55 L 258,55 262,60 250,65 240,62 Z",
    "M 225,58 L 240,58 240,62 250,65 245,75 228,75 Z",
    "M 228,75 L 245,75 252,78 258,85 255,95 248,98 240,95 235,85 228,80 Z",
    "M 258,39 L 260,38 260,40 258,41 Z",
  ],
  "Mid Atlantic":[
    "M 245,15 L 265,12 275,15 272,22 265,28 255,28 248,25 Z",
    "M 265,28 L 270,26 272,32 268,36 265,34 Z",
    "M 240,25 L 255,25 265,28 265,34 252,36 240,35 Z",
  ],
  "New England":[
    "M 275,2 L 282,5 285,12 280,15 275,12 272,8 Z",
    "M 268,10 L 272,8 275,12 275,18 270,18 Z",
    "M 275,12 L 278,12 278,20 275,22 272,18 275,18 Z",
    "M 272,22 L 282,20 285,22 280,24 272,24 Z",
    "M 280,24 L 283,23 284,26 281,26 Z",
    "M 272,24 L 280,24 280,28 272,28 Z",
  ],
};
const ALL_STATES = Object.entries(STATE_PATHS).flatMap(([division, paths]) =>
  paths.map(d => ({ d, division }))
);

// ════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ════════════════════════════════════════════════════════════════

function MiniDonut({value,size=44,color="#3b82f6",bg="#1e293b",strokeW=4}){
  const r=(size-strokeW)/2, c=2*Math.PI*r, o=c*(1-value/100);
  return(
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={strokeW}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.6s"}}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill="#e2e8f0"
        fontSize={size<36?8:10} fontWeight={700} fontFamily="'Nunito',sans-serif"
        style={{transform:"rotate(90deg)",transformOrigin:"center"}}>{value}%</text>
    </svg>
  );
}

function Donut({ value, label, subLabel, size = 88, strokeW = 9 }) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.ring2} strokeWidth={strokeW} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.ring1} strokeWidth={strokeW}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition:"stroke-dashoffset 0.6s" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, fontFamily:"'Nunito',sans-serif", lineHeight:1 }}>{value}%</div>
        </div>
      </div>
      <div style={{ marginTop:6, textAlign:"center" }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.accentLight, fontFamily:"'Nunito',sans-serif" }}>{label}</div>
        <div style={{ fontSize:7, color:C.text3, fontFamily:"'Nunito',sans-serif", marginTop:1 }}>{subLabel}</div>
      </div>
    </div>
  );
}

function SchemaBlock({label,text,color}){return(
  <div style={{display:"flex",gap:8,marginBottom:5}}>
    <div style={{width:3,background:color,borderRadius:2,flexShrink:0}}/>
    <div>
      <div style={{fontSize:8,fontWeight:700,color,fontFamily:"'Roboto Slab',serif",textTransform:"uppercase",letterSpacing:0.8,marginBottom:1}}>◆ {label}</div>
      <div style={{fontSize:10,color:"#94a3b8",lineHeight:1.5}}>{text}</div>
    </div>
  </div>
)}

function PrePostBar({pre,post,mw=75}){
  const d=post-pre;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {[{l:"PRE",v:pre,bc:"#475569",tc:"#94a3b8"},{l:"POST",v:post,bc:"#3b82f6",tc:"#e2e8f0"}].map((r,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:24,fontSize:8,color:i===0?"#64748b":"#60a5fa",textAlign:"right",fontFamily:"'Nunito',sans-serif"}}>{r.l}</span>
          <div style={{flex:1,height:11,background:"#1e293b",borderRadius:2}}>
            <div style={{width:`${(r.v/mw)*100}%`,height:"100%",background:r.bc,borderRadius:2,transition:"width 0.5s"}}/>
          </div>
          <span style={{width:34,fontSize:9,color:r.tc,fontFamily:"'Nunito',sans-serif",fontWeight:i===1?700:500}}>{r.v.toFixed(1)}</span>
        </div>
      ))}
      <div style={{textAlign:"right"}}>
        <span style={{fontSize:9,fontWeight:700,fontFamily:"'Nunito',sans-serif",color:d>0?"#34d399":d<0?"#f87171":"#64748b",padding:"1px 5px",borderRadius:6,background:d>0?"rgba(52,211,153,0.12)":d<0?"rgba(248,113,113,0.12)":"rgba(100,116,139,0.12)"}}>{d>0?"+":""}{d.toFixed(1)}</span>
      </div>
    </div>
  );
}
const PP_LABELS=[{key:"rank",label:"Industry Rank",sub:"Top-2 (1st/2nd)"},{key:"att1",label:"Domestic Mfg",sub:"Top-2 (6-7)"},{key:"att2",label:"Congress Support",sub:"Top-2 (6-7)"},{key:"fav",label:"Industry Fav",sub:"Top-4 (7-10)"}];

function TrustChart({pharma,corp,govt}){
  const max=7;const items=[{l:"Govt",v:govt,c:"#a78bfa"},{l:"Corp",v:corp,c:"#60a5fa"},{l:"Pharma",v:pharma,c:"#2dd4bf"}];
  return(<div style={{display:"flex",flexDirection:"column",gap:3}}>
    {items.map((it,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{width:34,fontSize:7,color:"#94a3b8",textAlign:"right",fontFamily:"'Nunito',sans-serif"}}>{it.l}</span>
      <div style={{flex:1,height:12,background:"#0f172a",borderRadius:3,position:"relative",overflow:"hidden"}}>
        <div style={{width:`${(it.v/max)*100}%`,height:"100%",background:it.c,borderRadius:3,opacity:0.85}}/>
        <div style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)",fontSize:8,fontWeight:700,color:"#e2e8f0",fontFamily:"'Nunito',sans-serif"}}>{it.v.toFixed(1)}</div>
      </div>
    </div>))}
  </div>);
}

// ════════════════════════════════════════════════════════════════
// VECTOR RADAR (prominent, larger)
// ════════════════════════════════════════════════════════════════
function ProfileVectorRadar({ seg }) {
  const isGOP = seg.party === "GOP";
  const vectors = isGOP ? GOP_VECTORS[seg.code] : DEM_VECTORS[seg.code];
  const axes = isGOP ? GOP_AXES : DEM_AXES;
  const [hovAxis, setHovAxis] = useState(null);
  if (!vectors) return null;

  const size = 260;
  const cx = size / 2, cy = size / 2, maxR = 90;
  const SCALE_MIN = -0.85, SCALE_MAX = 0.85, SCALE_RANGE = SCALE_MAX - SCALE_MIN;
  const valToR = (val) => ((val - SCALE_MIN) / SCALE_RANGE) * maxR;

  const partyColor = isGOP ? "#ef4444" : "#3b82f6";
  const fillColor = isGOP ? "rgba(239,68,68,0.22)" : "rgba(59,130,246,0.22)";
  const strokeColor = isGOP ? "#f87171" : "#60a5fa";
  const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI];

  const getPoint = (angle, radius) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  const gridVals = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6];
  const values = axes.map(a => vectors[a.key]);
  const polyPoints = values.map((v, i) => getPoint(angles[i], valToR(v)));
  const polyStr = polyPoints.map(p => `${p.x},${p.y}`).join(" ");
  const dots = values.map((v, i) => ({ ...getPoint(angles[i], valToR(v)), val: v }));

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:"visible" }}>
        {gridVals.map((gv, gi) => {
          const r = valToR(gv);
          const isZero = gv === 0;
          const isMajor = Math.abs(gv) === 0.4;
          return <circle key={gi} cx={cx} cy={cy} r={r} fill="none"
            stroke={isZero?"#475569":isMajor?"#1e293b":"#141a28"}
            strokeWidth={isZero?1.5:0.5}
            strokeDasharray={isZero?"none":isMajor?"3,3":"1,3"} />;
        })}
        <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="#1e293b" strokeWidth={0.5} />
        {angles.map((a, i) => {
          const outer = getPoint(a, maxR);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#1e293b" strokeWidth={0.5} />;
        })}
        <polygon points={polyStr} fill={fillColor} stroke={strokeColor} strokeWidth={2.5} strokeLinejoin="round" />
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={5} fill={strokeColor} stroke="#0a0e1a" strokeWidth={2} />
            <text
              x={d.x + (i===1?12:i===3?-12:0)}
              y={d.y + (i===0?-11:i===2?15:0)}
              textAnchor={i===1?"start":i===3?"end":"middle"}
              dominantBaseline={i===0?"auto":i===2?"hanging":"central"}
              fontSize={10} fontWeight={700} fill={strokeColor} fontFamily="'Nunito',sans-serif"
            >{d.val>0?"+":""}{d.val.toFixed(2)}</text>
          </g>
        ))}
        {axes.map((ax, i) => {
          const labelR = maxR + 24;
          const p = getPoint(angles[i], labelR);
          const anchor = i===1?"start":i===3?"end":"middle";
          const dy = i===0?-5:i===2?7:0;
          const isHov = hovAxis === ax.key;
          return (
            <g key={`label-${i}`}
              onMouseEnter={() => setHovAxis(ax.key)}
              onMouseLeave={() => setHovAxis(null)}
              style={{ cursor:"pointer" }}>
              <text x={p.x} y={p.y+dy} textAnchor={anchor} dominantBaseline="central"
                fontSize={9} fontWeight={700} fill={isHov?"#f8fafc":"#e2e8f0"} fontFamily="'Nunito',sans-serif" letterSpacing={0.3}
                textDecoration={isHov?"underline":"none"}>
                {ax.pos.toUpperCase()}
              </text>
              <text x={p.x} y={p.y+dy+11} textAnchor={anchor} dominantBaseline="central"
                fontSize={7} fontWeight={500} fill="#64748b" fontFamily="'Nunito',sans-serif">
                ← {ax.neg}
              </text>
            </g>
          );
        })}
      </svg>
      {hovAxis && VECTOR_DEFS[hovAxis] && (
        <div style={{
          position:"absolute", bottom:-8, left:"50%", transform:"translate(-50%, 100%)",
          width:280, background:"#1e293b", border:"1px solid #334155", borderRadius:8,
          padding:"10px 12px", zIndex:50, boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#a78bfa", fontFamily:"'Nunito',sans-serif", marginBottom:4, lineHeight:1.3 }}>
            {VECTOR_DEFS[hovAxis].title}
          </div>
          <div style={{ fontSize:9, color:"#cbd5e1", fontFamily:"'Nunito',sans-serif", lineHeight:1.5 }}>
            {VECTOR_DEFS[hovAxis].text}
          </div>
        </div>
      )}
    </div>
  );
}

// Diverging bar detail for vectors
function VectorBars({ seg }) {
  const isGOP = seg.party === "GOP";
  const vectors = isGOP ? GOP_VECTORS[seg.code] : DEM_VECTORS[seg.code];
  const axes = isGOP ? GOP_AXES : DEM_AXES;
  const [hovAxis, setHovAxis] = useState(null);
  if (!vectors) return null;
  const barColor = isGOP ? "#f87171" : "#60a5fa";
  const barBg = "#111827";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, position:"relative" }}>
      {axes.map((ax, i) => {
        const val = vectors[ax.key];
        const isPos = val >= 0;
        const absPct = Math.min(Math.abs(val) / 0.85 * 100, 100);
        const isHov = hovAxis === ax.key;
        return (
          <div key={ax.key}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
              <span
                onMouseEnter={() => setHovAxis(ax.key)}
                onMouseLeave={() => setHovAxis(null)}
                style={{ fontSize:8, color:!isPos?barColor:"#475569", fontWeight:!isPos?700:400, fontFamily:"'Nunito',sans-serif", cursor:"pointer", textDecoration:isHov?"underline":"none" }}>← {ax.neg}</span>
              <span
                onMouseEnter={() => setHovAxis(ax.key)}
                onMouseLeave={() => setHovAxis(null)}
                style={{ fontSize:8, color:isPos?barColor:"#475569", fontWeight:isPos?700:400, fontFamily:"'Nunito',sans-serif", cursor:"pointer", textDecoration:isHov?"underline":"none" }}>{ax.pos} →</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:0 }}>
              <div style={{ flex:1, height:22, background:barBg, borderRadius:"4px 0 0 4px", position:"relative", overflow:"hidden" }}>
                {!isPos && <div style={{ position:"absolute", right:0, top:0, height:"100%", width:`${absPct}%`, background:barColor, borderRadius:"4px 0 0 4px", opacity:0.7, transition:"width 0.5s" }} />}
                {!isPos && <div style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", fontSize:11, fontWeight:800, color:"#fff", fontFamily:"'Nunito',sans-serif" }}>{val.toFixed(2)}</div>}
              </div>
              <div style={{ width:2, height:28, background:"#475569", flexShrink:0, zIndex:2 }} />
              <div style={{ flex:1, height:22, background:barBg, borderRadius:"0 4px 4px 0", position:"relative", overflow:"hidden" }}>
                {isPos && <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${absPct}%`, background:barColor, borderRadius:"0 4px 4px 0", opacity:0.7, transition:"width 0.5s" }} />}
                {isPos && <div style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%)", fontSize:11, fontWeight:800, color:"#fff", fontFamily:"'Nunito',sans-serif" }}>+{val.toFixed(2)}</div>}
              </div>
            </div>
          </div>
        );
      })}
      {hovAxis && VECTOR_DEFS[hovAxis] && (
        <div style={{
          position:"absolute", top:-8, left:"50%", transform:"translate(-50%, -100%)",
          width:280, background:"#1e293b", border:"1px solid #334155", borderRadius:8,
          padding:"10px 12px", zIndex:50, boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
          pointerEvents:"none",
        }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#a78bfa", fontFamily:"'Nunito',sans-serif", marginBottom:4, lineHeight:1.3 }}>
            {VECTOR_DEFS[hovAxis].title}
          </div>
          <div style={{ fontSize:9, color:"#cbd5e1", fontFamily:"'Nunito',sans-serif", lineHeight:1.5 }}>
            {VECTOR_DEFS[hovAxis].text}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// GEOGRAPHY MAP (from demo-panels)
// ════════════════════════════════════════════════════════════════
function CensusDivisionMap({ division, pct }) {
  const [hover, setHover] = useState(null);
  const centers = {
    "Pacific":[88,45],"Mountain":[128,45],"West North Central":[185,30],
    "East North Central":[222,35],"West South Central":[165,78],
    "East South Central":[225,60],"South Atlantic":[250,60],
    "Mid Atlantic":[258,28],"New England":[278,18],
  };
  return (
    <div>
      <svg viewBox="10 -2 290 108" width="100%" style={{ maxHeight:160 }}>
        <rect x="10" y="-2" width="290" height="108" fill={C.bg} rx="4" />
        {ALL_STATES.map((state, i) => {
          const isActive = state.division === division;
          const isHov = hover === state.division && !isActive;
          return <path key={i} d={state.d}
            fill={isActive?C.mapActive:isHov?"#2a4a6a":C.mapIdle}
            stroke={isActive?C.mapActiveBorder:C.mapIdleBorder}
            strokeWidth={isActive?1.2:0.4}
            opacity={isActive?1:isHov?0.8:0.5}
            style={{ transition:"all 0.3s", cursor:"pointer" }}
            onMouseEnter={()=>setHover(state.division)}
            onMouseLeave={()=>setHover(null)} />;
        })}
        {(() => {
          const [cx, cy] = centers[division] || [150, 50];
          return <g>
            <rect x={cx-18} y={cy-8} width={36} height={16} rx={3} fill={C.accent} fillOpacity={0.95} stroke={C.accentLight} strokeWidth={0.5} />
            <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={800} fill="#fff" fontFamily="'Nunito',sans-serif">{pct}</text>
          </g>;
        })()}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.accentLight, fontFamily:"'Nunito',sans-serif" }}>{division}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:C.mapActive, border:`1px solid ${C.mapActiveBorder}` }} />
            <span style={{ fontSize:7, color:C.text2, fontFamily:"'Nunito',sans-serif" }}>Dominant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DEMOGRAPHICS TAB
// ════════════════════════════════════════════════════════════════
function DemographicsPanel({ seg }) {
  const segIdx = seg.id - 1;
  const male = parseInt(seg.demo.male) || 50;
  const nw = parseInt(seg.demo.nonwhite) || 0;
  const white = 100 - nw;

  // Religion data for this segment — find the max
  const relData = RELIGION_CATS.map(cat => ({
    label: cat.label,
    value: RELIGION_DATA[cat.key][segIdx],
    overindex: (RELIGION_OVERINDEX[cat.key] || []).includes(segIdx),
  }));
  const maxRel = Math.max(...relData.map(r => r.value));

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      {/* Row 1: Core Demo + Geography */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        {/* Core Demographics */}
        <div style={{ background:C.card, borderRadius:8, padding:18, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.text2, fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>CORE DEMOGRAPHICS</div>
          <div style={{ display:"flex", justifyContent:"center", gap:32, marginBottom:18, paddingBottom:16, borderBottom:`1px solid ${C.border}` }}>
            <Donut value={male} label="Male" subLabel={`${100-male}% Female`} />
            <Donut value={white} label="White" subLabel={`${nw}% Nonwhite`} />
          </div>
          <div style={{ display:"flex", gap:0 }}>
            {[
              { label:"MEDIAN AGE", value:seg.demo.medAge },
              { label:"MEAN HHI", value:seg.demo.hhi },
              { label:"COLLEGE +", value:seg.demo.college },
            ].map((s, i) => (
              <div key={i} style={{ flex:1, textAlign:"center", borderRight:i<2?`1px solid ${C.border}`:"none", padding:"4px 0" }}>
                <div style={{ fontSize:20, fontWeight:800, color:C.text1, fontFamily:"'Nunito',sans-serif", lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:7, color:C.text3, fontFamily:"'Nunito',sans-serif", textTransform:"uppercase", letterSpacing:1, marginTop:5 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* M4A / Vax Avoid */}
          <div style={{ display:"flex", gap:16, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:6, color:"#475569", fontFamily:"'Nunito',sans-serif", marginBottom:2 }}>SUPPORT M4A</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#94a3b8", fontFamily:"'Nunito',sans-serif" }}>{seg.demo.m4a}</div>
            </div>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:6, color:"#475569", fontFamily:"'Nunito',sans-serif", marginBottom:2 }}>VAX AVOIDANT</div>
              <div style={{ fontSize:18, fontWeight:800, color:parseInt(seg.demo.vaxAvoid)>=30?"#f87171":"#94a3b8", fontFamily:"'Nunito',sans-serif" }}>{seg.demo.vaxAvoid}</div>
            </div>
          </div>
        </div>

        {/* Geography */}
        <div style={{ background:C.card, borderRadius:8, padding:18, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.text2, fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>GEOGRAPHY</div>
          <CensusDivisionMap division={seg.demo.cenDiv} pct={seg.demo.cenPct} />
          <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:24, fontWeight:800, color:C.text1, fontFamily:"'Nunito',sans-serif", minWidth:52, textAlign:"center" }}>{seg.demo.rural}</div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:C.text1, fontFamily:"'Nunito',sans-serif" }}>Rural</div>
              <div style={{ fontSize:8, color:C.text3, fontFamily:"'Nunito',sans-serif" }}>Share residing in rural areas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Military / Union / Religion */}
      <div style={{ display:"grid", gridTemplateColumns:"200px 200px 1fr", gap:12, marginBottom:12 }}>
        {/* Military */}
        <div style={{ background:C.card, borderRadius:8, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.text2, fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>MILITARY</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:32, fontWeight:800, color:C.text1, fontFamily:"'Nunito',sans-serif" }}>
              {Math.round(MILITARY[segIdx])}%
            </div>
            <div style={{ fontSize:8, color:C.text3, fontFamily:"'Nunito',sans-serif", marginTop:4 }}>Active duty or veteran</div>
          </div>
          <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
            <div style={{ height:6, background:"#0f172a", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${(MILITARY[segIdx]/20)*100}%`, height:"100%", background:"#5b93c7", borderRadius:3, transition:"width 0.5s" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:6, color:C.text3, marginTop:3, fontFamily:"'Nunito',sans-serif" }}>
              <span>0%</span><span>Pop avg ~9%</span><span>20%</span>
            </div>
          </div>
        </div>

        {/* Union */}
        <div style={{ background:C.card, borderRadius:8, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.text2, fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>UNION HOUSEHOLD</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:32, fontWeight:800, color:UNION_HH[segIdx]>=20?"#a78bfa":C.text1, fontFamily:"'Nunito',sans-serif" }}>
              {Math.round(UNION_HH[segIdx])}%
            </div>
            <div style={{ fontSize:8, color:C.text3, fontFamily:"'Nunito',sans-serif", marginTop:4 }}>Union household member</div>
          </div>
          <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
            <div style={{ height:6, background:"#0f172a", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${(UNION_HH[segIdx]/30)*100}%`, height:"100%", background:UNION_HH[segIdx]>=20?"#a78bfa":"#5b93c7", borderRadius:3, transition:"width 0.5s" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:6, color:C.text3, marginTop:3, fontFamily:"'Nunito',sans-serif" }}>
              <span>0%</span><span>Pop avg ~16%</span><span>30%</span>
            </div>
          </div>
        </div>

        {/* Religion */}
        <div style={{ background:C.card, borderRadius:8, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.text2, fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>RELIGION</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {relData.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ width:90, fontSize:8, color:r.overindex?C.accentLight:C.text2, fontWeight:r.overindex?700:400, fontFamily:"'Nunito',sans-serif", textAlign:"right", flexShrink:0 }}>{r.label}</span>
                <div style={{ flex:1, height:14, background:"#0f172a", borderRadius:3, position:"relative", overflow:"hidden" }}>
                  <div style={{ width:`${(r.value/Math.max(maxRel,65))*100}%`, height:"100%", background:r.overindex?"#5b93c7":"#2a4a6a", borderRadius:3, transition:"width 0.5s", border:r.overindex?"1px solid #7eb3e0":"none" }} />
                </div>
                <span style={{ width:36, fontSize:9, fontWeight:r.overindex?800:500, color:r.overindex?"#7eb3e0":C.text2, fontFamily:"'Nunito',sans-serif", textAlign:"right" }}>
                  {r.value.toFixed(1)}%
                </span>
                {r.overindex && <span style={{ fontSize:7, fontWeight:800, color:"#fbbf24", fontFamily:"'Nunito',sans-serif" }}>↑</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// IDEOLOGY TAB (heatmap filtered for single segment, with all-seg context)
// ════════════════════════════════════════════════════════════════
function IdeologyPanel({ seg }) {
  const segIdx = seg.id - 1;
  const allDims = IDEOLOGY_GROUPS.flatMap(g => g.dims);
  const means = {};
  allDims.forEach(d => {
    const vals = IDEOLOGY_DATA[d.key];
    means[d.key] = vals.reduce((a,b)=>a+b,0)/vals.length;
  });

  function getColor(val){
    const t = Math.max(0,Math.min(1,(val-1.5)/5.0));
    if(t<0.35){ const s=t/0.35; return `rgba(59,130,246,${0.50-s*0.18})`; }
    else if(t<0.55){ const s=(t-0.35)/0.2; return `rgba(100,116,139,${0.08+s*0.04})`; }
    else { const s=(t-0.55)/0.45; return `rgba(239,68,68,${0.12+s*0.42})`; }
  }
  function getTC(val){ if(val>=5.3)return"#fecaca"; if(val>=4.8)return"#d1d5db"; if(val<=2.5)return"#bfdbfe"; if(val<=3.2)return"#c7d2db"; return"#8a95a5"; }

  // Show a single-column heatmap for this segment plus deviation from mean
  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:12, lineHeight:1.5 }}>
        Segment means on 1–7 bipolar ideological scales. Deviation from the 16-segment mean shown alongside.
      </div>

      {/* Legend */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:0, borderRadius:4, overflow:"hidden" }}>
          {[2.0,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0].map(v => (
            <div key={v} style={{ width:22, height:14, background:getColor(v), display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:6, color:getTC(v), fontWeight:600 }}>{v.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize:7, color:"#64748b", fontFamily:"'Nunito',sans-serif" }}>← Liberal pole · Conservative pole →</span>
      </div>

      <div style={{ background:C.card, borderRadius:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        {IDEOLOGY_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {group.dims.map((dim, di) => {
              const val = IDEOLOGY_DATA[dim.key][segIdx];
              const mean = means[dim.key];
              const dev = val - mean;
              return (
                <div key={dim.key} style={{
                  display:"grid", gridTemplateColumns:"36px 110px 80px 80px 1fr",
                  alignItems:"center", padding:"6px 8px",
                  borderBottom:`1px solid ${C.border}`,
                  background:di===0?`${group.color}08`:"transparent",
                }}>
                  {di===0 ? (
                    <div style={{ fontSize:7, fontWeight:700, color:group.color, fontFamily:"'Roboto Slab',serif", letterSpacing:1 }}>{group.label}</div>
                  ) : <div />}
                  <div style={{ fontSize:10, fontWeight:700, color:"#bfc8d4", letterSpacing:0.2 }}>{dim.label}</div>
                  <div>
                    <div style={{ fontSize:7, color:"#6b93c0", fontWeight:600 }}>{dim.lo}</div>
                    <div style={{ fontSize:7, color:"#c07b7b", fontWeight:600, marginTop:1 }}>{dim.hi}</div>
                  </div>
                  {/* Heatmap cell */}
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <div style={{
                      width:64, height:36, borderRadius:4, background:getColor(val),
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    }}>
                      <div style={{ fontSize:14, fontWeight:700, color:getTC(val), lineHeight:1 }}>{val.toFixed(1)}</div>
                      <div style={{
                        fontSize:7, fontWeight:600, marginTop:1,
                        color:Math.abs(dev)>=0.7?(dev>0?"rgba(252,165,165,0.9)":"rgba(147,197,253,0.9)"):
                              Math.abs(dev)>=0.4?(dev>0?"rgba(252,165,165,0.6)":"rgba(147,197,253,0.6)"):"rgba(148,163,184,0.3)",
                      }}>{dev>0?"+":""}{dev.toFixed(1)}</div>
                    </div>
                  </div>
                  {/* Deviation bar */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft:8 }}>
                    <div style={{ flex:1, height:12, display:"flex", alignItems:"center" }}>
                      <div style={{ flex:1, height:8, background:"#0f172a", borderRadius:3, position:"relative" }}>
                        {/* Center line */}
                        <div style={{ position:"absolute", left:"50%", top:-2, height:12, width:1, background:"#475569" }} />
                        {/* Dev bar */}
                        {dev !== 0 && (
                          <div style={{
                            position:"absolute",
                            left: dev<0 ? `${50 + (dev/2)*100}%` : "50%",
                            width: `${Math.abs(dev/2)*100}%`,
                            top:0, height:"100%",
                            background: dev>0 ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.5)",
                            borderRadius:2,
                          }} />
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize:8, fontWeight:700, color:dev>0?"#fca5a5":dev<0?"#93c5fd":"#64748b", fontFamily:"'Nunito',sans-serif", width:32, textAlign:"right" }}>
                      {dev>0?"+":""}{dev.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
            {gi < IDEOLOGY_GROUPS.length - 1 && <div style={{ height:4, background:C.bg }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PROFILE PAGE
// ════════════════════════════════════════════════════════════════

// ═══ PROFILER DATA & PANELS (from prism-profiler) ═══════════════════════════
const CP = {
  bg:"#0f1a2e", card:"#162036", cardBorder:"#1e3050", steel:"#5b93c7",
  amber:"#d4915e", text:"#e2e8f0", textMuted:"#8194a8", textDim:"#4a5f78",
  green:"#4ade80", red:"#f87171", white:"#ffffff", govtBlue:"#6ba3d6",
  corpAmber:"#d4915e", dotStrip:"#1a2940", partyGOP:"#cf4040", partyDEM:"#4080cf",
  cyan:"#22d3ee", violet:"#a78bfa", rose:"#fb7185", teal:"#2dd4bf",
};

const TRUST_DATA = {
  GOVT:[4.26,4.07,4.04,3.57,4.07,4.16,3.32,3.77,3.65,3.07,4.52,5.12,3.78,4.85,5.02,5.66],
  CORP:[3.96,3.79,4.01,3.52,3.39,4.05,3.24,3.48,3.32,2.78,2.51,4.11,2.71,4.12,4.17,4.31],
  GAP:[0.30,0.28,0.03,0.05,0.68,0.11,0.08,0.29,0.33,0.29,2.01,1.01,1.07,0.73,0.85,1.35],
};
const GAP_AVG=0.5912;
const POP_T=SEGMENTS.reduce((s,g)=>s+g.pop,0);
const AVG_G=SEGMENTS.reduce((s,g,i)=>s+g.pop*TRUST_DATA.GOVT[i],0)/POP_T;
const AVG_C=SEGMENTS.reduce((s,g,i)=>s+g.pop*TRUST_DATA.CORP[i],0)/POP_T;

const ENTITIES = {
  PHARMA:{l:"Pharma",g:"corp",v:[3.71,3.57,3.94,3.11,3.07,3.67,2.75,3.28,2.88,2.30,2.06,4.02,2.30,4.16,4.09,4.54],a:3.34},
  INSURER:{l:"Insurers",g:"corp",v:[4.04,3.63,4.11,3.58,3.19,4.09,3.46,3.66,3.23,2.81,2.10,4.23,2.74,4.01,4.27,4.33],a:3.59},
  HOSPITAL:{l:"Hospitals",g:"corp",v:[5.20,4.74,5.02,4.58,4.31,4.64,4.00,4.39,4.42,3.76,4.30,5.22,3.96,5.14,5.11,5.76],a:4.66},
  PROVIDER:{l:"Providers",g:"corp",v:[5.07,4.99,5.10,4.70,4.46,4.38,4.18,4.25,4.41,3.58,4.43,5.27,4.00,5.19,5.33,5.94],a:4.71},
  FED:{l:"FDA / CDC",g:"govt",v:[4.21,3.94,3.92,3.24,3.91,4.02,2.92,3.60,3.24,2.63,4.29,4.92,3.64,4.75,4.94,5.35],a:3.97},
  NIH:{l:"NIH",g:"govt",v:[4.02,3.92,3.89,3.29,4.01,4.13,3.10,3.52,3.47,2.84,4.64,5.09,3.90,4.88,5.13,5.71],a:4.10},
  MEDICARE:{l:"Medicare",g:"govt",v:[4.80,4.61,4.63,4.27,4.36,4.42,3.96,4.16,4.23,3.66,4.58,5.36,3.86,5.10,5.13,6.01],a:4.57},
  ACADEMIA:{l:"Academia",g:"govt",v:[4.22,4.27,4.16,3.63,4.42,4.40,3.45,4.02,3.98,3.31,5.30,5.42,4.36,5.05,5.34,6.01],a:4.46},
  BIGAG:{l:"Big Ag",g:"o",v:[4.19,3.97,4.10,3.84,3.69,4.12,3.39,3.61,3.47,3.10,2.66,4.09,2.91,4.10,4.21,4.16],a:3.73},
  FARMER:{l:"Farmers",g:"o",v:[5.70,5.54,5.44,5.63,5.30,5.11,5.33,5.55,5.42,5.25,4.89,5.47,4.76,5.40,5.24,5.64],a:5.35},
  CONSUMERS:{l:"Consumers",g:"o",v:[4.42,4.15,4.17,4.12,4.05,4.32,4.03,4.16,4.16,3.82,3.84,4.64,3.68,4.42,4.48,4.56],a:4.19},
  PBM:{l:"PBMs",g:"o",v:[3.50,3.28,3.58,3.14,3.12,3.78,2.95,3.39,2.98,2.58,2.33,3.94,2.56,3.70,3.87,3.93],a:3.29},
  EPA:{l:"EPA",g:"o",v:[3.96,3.80,3.69,3.28,3.97,4.05,3.03,3.61,3.47,2.81,4.64,5.12,3.79,4.76,5.05,5.58],a:4.04},
  BIGTECH:{l:"Big Tech",g:"o",v:[3.43,3.51,3.66,3.04,3.16,3.95,3.00,2.93,3.04,2.36,2.01,3.63,2.28,3.92,3.83,3.69],a:3.22},
  BIOTECH:{l:"Biotech",g:"o",v:[3.92,3.85,3.99,3.61,3.44,4.24,3.41,3.47,3.54,3.08,3.17,4.27,2.98,4.16,4.20,4.44],a:3.74},
  BIGFOOD:{l:"Big Food",g:"o",v:[4.46,4.20,4.29,3.95,3.78,4.25,3.46,3.92,3.73,3.07,3.04,4.42,3.03,4.38,4.45,4.69],a:3.95},
};

// ─── BELIEFS DATA (top-3-box) ────────────────────────────────────────────────
const BELIEFS = [
{v:"CHOICE",ty:"ATT",t:"Individuals should have more autonomy in making personal health decisions without government interference.",t3b:[0.8550,0.9170,0.9040,0.9080,0.8910,0.7460,0.9330,0.8130,0.9130,0.8970,0.8250,0.8810,0.7910,0.8190,0.7810,0.8010],a:0.8543},
  {v:"PROFIT",ty:"ATT",t:"Big pharma put profits over patients.",t3b:[0.8820,0.9190,0.7420,0.9070,0.9680,0.8760,0.9480,0.8150,0.9710,0.9220,0.9720,0.9300,0.9270,0.8450,0.7870,0.8710],a:0.8967},
  {v:"INDIVID_RESP",ty:"ATT",t:"People's health is mostly determined by their own choices, not their environment or circumstances.",t3b:[0.6270,0.6020,0.6690,0.7160,0.4760,0.7100,0.7700,0.6710,0.6120,0.6690,0.1740,0.3490,0.2230,0.4930,0.4050,0.2580],a:0.4688},
  {v:"IMMUNITY",ty:"ATT",t:"Natural immunity should count for more than vaccine mandates when setting public",t3b:[0.5620,0.5490,0.5520,0.7340,0.5090,0.5860,0.8620,0.7210,0.6490,0.8140,0.1180,0.3450,0.2350,0.3150,0.2040,0.1540],a:0.4285},
  {v:"ELITES",ty:"ATT",t:"Medical experts and scientists often ignore what ordinary people know from experience and should not dictate public policy health rules in future pandemics.",t3b:[0.6550,0.5390,0.5510,0.7240,0.5920,0.6870,0.8430,0.6370,0.6140,0.7730,0.1740,0.3710,0.2930,0.3900,0.3220,0.2110],a:0.4586},
  {v:"EQUITY_FUNDING",ty:"ATT",t:"The federal government should invest extra funds in communities of color that have suffered historic health injustices, even if it means higher taxes.",t3b:[0.3250,0.1580,0.1200,0.1230,0.1970,0.3460,0.2430,0.2900,0.1900,0.1960,0.9040,0.7280,0.4990,0.4220,0.5000,0.8080],a:0.4476},
  {v:"REFUSAL",ty:"ATT",t:"Patients have the right to refuse any medical intervention, even when experts say their decision could endanger public health.",t3b:[0.5270,0.6480,0.5890,0.7460,0.6420,0.6420,0.8450,0.7060,0.6490,0.7840,0.1680,0.5470,0.4210,0.4800,0.3560,0.2730],a:0.5162},
  {v:"RWE",ty:"ATT",t:"The FDA should allow conditional approvals that rely on real world evidence collected after a drug reaches the market, rather than insisting on full randomized trials first",t3b:[0.6130,0.4870,0.5230,0.5590,0.4760,0.4950,0.6580,0.5510,0.5520,0.5620,0.3540,0.5530,0.3220,0.4850,0.4460,0.4040],a:0.4815},
  {v:"INFLUENCE",ty:"ATT",t:"Big corporations have too much influence over public health policies.",t3b:[0.8040,0.8440,0.7030,0.8600,0.9480,0.8460,0.9140,0.7530,0.8770,0.8720,0.9680,0.8920,0.8920,0.8080,0.7680,0.8830],a:0.8614},
  {v:"CLINICIAN_AUTONOMY",ty:"ATT",t:"Clinicians should never be forced by law to provide treatments that violate their religious or moral beliefs.",t3b:[0.8470,0.7630,0.7840,0.8790,0.6260,0.7400,0.8950,0.7650,0.7300,0.7670,0.1600,0.4830,0.4130,0.5170,0.4430,0.2190],a:0.558},
  {v:"DATA_PORT",ty:"ATT",t:"Health care companies should be required to let patients move their medical records and insurance information easily to any doctor, app, or service they want.",t3b:[0.9640,0.9690,0.9710,0.9600,0.9670,0.8130,0.9520,0.9580,0.9570,0.9420,0.9790,0.9780,0.9370,0.9280,0.9370,0.9820],a:0.9575},
  {v:"PRO_MARRIAGE",ty:"ATT",t:"Government should offer financial incentives for married couples to have and raise children in stable families.",t3b:[0.4720,0.3070,0.3780,0.4550,0.3280,0.4400,0.5750,0.4840,0.3360,0.5200,0.2140,0.4410,0.2740,0.3830,0.2430,0.2410],a:0.356},
  {v:"MED_LIBERTY",ty:"ATT",t:"Mandating any medical treatment violates personal liberty.",t3b:[0.6290,0.6900,0.7070,0.8330,0.7640,0.6060,0.9210,0.6960,0.8420,0.8390,0.2640,0.5520,0.5010,0.4360,0.3710,0.2950],a:0.5718},
  {v:"PHARMA_IP",ty:"ATT",t:"Pharma companies abuse the patent system to prevent competition and delay generic drugs.",t3b:[0.7420,0.7600,0.6510,0.7870,0.9170,0.7570,0.8070,0.6630,0.8890,0.8230,0.9080,0.7540,0.8370,0.6970,0.7160,0.7680],a:0.7839},
  {v:"GENDER",ty:"ATT",t:"Medical treatments that permanently alter a minor's sex characteristics should be restricted until the patient reaches adulthood.",t3b:[0.9300,0.9510,0.9290,0.9650,0.9050,0.9030,0.9530,0.8700,0.9650,0.9620,0.4140,0.7130,0.7660,0.7950,0.7570,0.4110],a:0.7695},
  {v:"FLUORIDE",ty:"ATT",t:"Fluoride should be removed from tap water.",t3b:[0.3440,0.2830,0.2610,0.5110,0.3100,0.4470,0.6670,0.5190,0.4550,0.6330,0.0840,0.2480,0.1970,0.2210,0.1770,0.0900],a:0.2933},
  {v:"BUILD_THAT",ty:"ATT",t:"Most breakthroughs in medicines are not made by pharmaceutical companies but are by scientists at NIH and universities.",t3b:[0.4200,0.3810,0.3350,0.3440,0.5370,0.4610,0.4560,0.4650,0.5180,0.5390,0.9000,0.7900,0.6830,0.6440,0.5730,0.8140],a:0.6025},
  {v:"WOKE",ty:"ATT",t:"Health care companies focus too much on woke capitalism issues like \"ESG\" (environmental, social and governance) and \"DEI\" (diversity, equity and inclusion).",t3b:[0.7660,0.7290,0.7690,0.8230,0.6940,0.5400,0.8050,0.6430,0.8020,0.8120,0.0650,0.2630,0.2420,0.3970,0.2950,0.1220],a:0.4695},
  {v:"RED_MEAT",ty:"ATT",t:"Red meat is healthier than plant-based protein for most people.",t3b:[0.5380,0.5020,0.5310,0.6820,0.4620,0.5030,0.7260,0.6210,0.6150,0.7290,0.1300,0.3030,0.2470,0.3180,0.3120,0.1750],a:0.408},
  {v:"BODY_SANCTITY",ty:"ATT",t:"I would feel deeply uncomfortable if medical research used human body parts in ways I consider disrespectful.",t3b:[0.7370,0.6370,0.6400,0.7870,0.6950,0.6840,0.8490,0.7270,0.7400,0.7460,0.3140,0.7110,0.5680,0.5830,0.4790,0.4720],a:0.6129},
  {v:"AI_REG",ty:"ATT",t:"Artificial intelligence systems that diagnose disease ought to be regulated with the same strict standards as traditional medical devices.",t3b:[0.8650,0.8370,0.8710,0.9300,0.9350,0.8210,0.9180,0.7300,0.9170,0.8950,0.9300,0.9330,0.8490,0.8650,0.8660,0.9370],a:0.8928},
  {v:"MRNA",ty:"ATT",t:"The science behind new therapies, like mRNA used in the Covid vaccines, has not been fully tested or proven safe.",t3b:[0.5760,0.5510,0.5400,0.7600,0.5620,0.5590,0.8890,0.6880,0.7470,0.8030,0.1060,0.3000,0.3060,0.3090,0.2040,0.1170],a:0.4317},
  {v:"NATURAL_ORDER",ty:"ATT",t:"Even if no one is harmed, practices that go against the natural order of the human body are morally wrong.",t3b:[0.6830,0.5510,0.6420,0.7670,0.5140,0.6490,0.8250,0.6920,0.6320,0.7210,0.1290,0.4050,0.3730,0.4270,0.2860,0.1830],a:0.4684},
  {v:"VAX_SAFETY",ty:"ATT",t:"Vaccines may do more harm than good, potentially causing other health problems.",t3b:[0.2930,0.1890,0.2620,0.4540,0.2440,0.4080,0.6630,0.4940,0.4690,0.6780,0.0740,0.2150,0.1320,0.2330,0.1380,0.0800],a:0.2676},
  {v:"OPIOIDS",ty:"ATT",t:"Big pharma is primarily responsible for the opioid epidemic.",t3b:[0.4670,0.5440,0.4200,0.5840,0.7320,0.5650,0.7190,0.5470,0.7830,0.7630,0.9190,0.7200,0.7590,0.5780,0.5510,0.7050],a:0.6712},
  {v:"EXPERIMENTAL_RX",ty:"ATT",t:"Terminally ill patients should have automatic access to experimental drugs once Phase I testing shows they are safe.",t3b:[0.9080,0.8990,0.9150,0.9190,0.9460,0.7890,0.8910,0.8600,0.8900,0.8650,0.9580,0.9150,0.8360,0.8850,0.7710,0.9470],a:0.8965},
  {v:"CLINICAL_TRIALS",ty:"ATT",t:"Clinical trial research gets hidden and misrepresented regularly.",t3b:[0.5670,0.5420,0.5250,0.6670,0.6560,0.7140,0.8100,0.6310,0.6790,0.7740,0.3930,0.4880,0.5160,0.3770,0.3460,0.2940],a:0.5176},
  {v:"NATUROPATHIC",ty:"ATT",t:"Herbal and naturopathic remedies can be just as effective as pharmaceuticals for many long-term illnesses",t3b:[0.4450,0.4110,0.3660,0.5490,0.4840,0.5260,0.7610,0.6760,0.6050,0.7530,0.2580,0.4320,0.4100,0.4460,0.2900,0.2220],a:0.4367},
  {v:"SDOH",ty:"ATT",t:"Addressing housing, food and other social drivers of health should receive higher priority than paying hospitals for new high-tech procedures",t3b:[0.4430,0.4190,0.3530,0.4490,0.5960,0.6200,0.7170,0.6110,0.6590,0.5940,0.8330,0.7920,0.7140,0.6040,0.4980,0.6900],a:0.6211},
  {v:"UNION_PLAN",ty:"POL",t:"Union health plans that workers fought for should be protected.",t3b:[0.7110,0.6140,0.5840,0.5920,0.7600,0.7120,0.6620,0.6590,0.6630,0.6330,0.9560,0.9510,0.8610,0.7810,0.7570,0.9600],a:0.7744},
  {v:"MED_NEGOT",ty:"POL",t:"Medicare should negotiate prescription",t3b:[0.7280,0.6780,0.6070,0.6590,0.7100,0.6750,0.7280,0.5920,0.7160,0.6380,0.8510,0.7790,0.6850,0.7760,0.6630,0.8140],a:0.7239},
  {v:"WORK_REQ",ty:"POL",t:"Medicaid should require able",t3b:[0.9050,0.8750,0.8600,0.9040,0.8140,0.6750,0.8840,0.7220,0.8490,0.7880,0.3580,0.5760,0.5640,0.6650,0.6210,0.4090],a:0.6693},
  {v:"MANDATE_POLICY",ty:"POL",t:"Public health rules for future pandemics should rely on natural immunity status rather than vaccine mandates.",t3b:[0.5030,0.4670,0.4690,0.6440,0.3930,0.4760,0.7850,0.5830,0.5650,0.6860,0.1210,0.2620,0.1870,0.2890,0.1920,0.1320],a:0.3676},
  {v:"NIH_FUND",ty:"POL",t:"Budgets for NIH and CDC should be increased, not cut.",t3b:[0.3750,0.2980,0.2750,0.1800,0.3850,0.4470,0.2370,0.3670,0.2860,0.1680,0.9370,0.8230,0.6600,0.7060,0.7710,0.9550],a:0.5668},
  {v:"MA",ty:"POL",t:"Medicare Advantage should be protected from funding cuts.",t3b:[0.7150,0.6860,0.6810,0.6360,0.7210,0.6430,0.7430,0.7570,0.7330,0.7080,0.9380,0.9130,0.8260,0.7970,0.8240,0.9360],a:0.7947},
  {v:"EARLY_ACCESS",ty:"POL",t:"Terminally ill patients should get automatic access to experimental drugs once Phase I safety is shown.",t3b:[0.8840,0.8600,0.8840,0.8880,0.9030,0.7940,0.8670,0.8860,0.8640,0.8280,0.9710,0.8950,0.7730,0.8570,0.7400,0.9230],a:0.8718},
  {v:"DATA_OWNERSHIP",ty:"POL",t:"Patients should own and be able to profit from their own personal health",t3b:[0.6570,0.6590,0.6530,0.6350,0.6550,0.5850,0.7360,0.6640,0.6400,0.6580,0.8300,0.7600,0.6660,0.6890,0.6500,0.7850],a:0.7014},
  {v:"LONGEVITY_POLICY",ty:"POL",t:"Public policy should support research aimed at extending the human lifespan beyond 120 years.",t3b:[0.2750,0.2010,0.2230,0.2110,0.1950,0.4450,0.3390,0.3950,0.2140,0.2030,0.2990,0.4610,0.2340,0.3780,0.2230,0.3810],a:0.2953},
  {v:"GMO_LABEL",ty:"POL",t:"Foods containing genetically modified ingredients should carry warning labels.",t3b:[0.8120,0.7760,0.7500,0.8890,0.7830,0.8060,0.9330,0.8260,0.9030,0.8730,0.8530,0.9090,0.8470,0.8170,0.7910,0.8370],a:0.8435},
  {v:"WHO_POLICY",ty:"POL",t:"The United States should leave the World Health Organization if it threatens national sovereignty over health policy.",t3b:[0.6490,0.6090,0.6650,0.7940,0.5200,0.4760,0.8380,0.6540,0.6280,0.7440,0.0760,0.2560,0.1640,0.2700,0.2110,0.1280],a:0.4121},
  {v:"HEALTH_DISC",ty:"POL",t:"Health insurance should cost less for people who take steps to stay healthy.",t3b:[0.8080,0.8720,0.8010,0.7970,0.7350,0.7050,0.8210,0.7900,0.8660,0.7800,0.8150,0.8180,0.7170,0.7860,0.7810,0.7590],a:0.7944},
  {v:"MEDICAID",ty:"POL",t:"Medicaid should be protected from budget cuts.",t3b:[0.6180,0.5200,0.5180,0.4960,0.7170,0.6540,0.5300,0.7220,0.6340,0.6580,0.9890,0.9780,0.8540,0.8730,0.8240,0.9770],a:0.7661},
  {v:"RURAL_SUBSIDY",ty:"POL",t:"The federal government should subsidize rural hospitals, even if that increases overall spending.",t3b:[0.5830,0.4290,0.4800,0.3600,0.5510,0.4250,0.3860,0.4470,0.4670,0.3430,0.9310,0.8260,0.6650,0.7070,0.7000,0.8970],a:0.63},
  {v:"GENDER_CARE",ty:"POL",t:"Insurance should be required to cover gender",t3b:[0.1850,0.1720,0.0930,0.0690,0.0940,0.3190,0.1750,0.2430,0.0870,0.0950,0.8440,0.5820,0.1920,0.3170,0.2660,0.7660],a:0.3479},
  {v:"NATAL_POLICY",ty:"POL",t:"Government should offer tax bonuses or cash allowances to married couples who have children.",t3b:[0.4870,0.3810,0.3590,0.4570,0.3910,0.4540,0.5530,0.5080,0.3890,0.4990,0.3690,0.5430,0.3120,0.4010,0.2840,0.3480],a:0.4095},
  {v:"IMMIG",ty:"POL",t:"Immigration policy should protect American health care jobs and workers.",t3b:[0.7260,0.7150,0.8060,0.7800,0.7650,0.5470,0.8060,0.6590,0.8230,0.7880,0.7960,0.8260,0.6540,0.7900,0.7090,0.8290],a:0.7684},
  {v:"MENTAL1",ty:"POL",t:"The government should expand funding for community",t3b:[0.4580,0.3080,0.3060,0.3100,0.4140,0.4360,0.3310,0.3760,0.3970,0.2900,0.9490,0.8900,0.6650,0.6730,0.6150,0.9300],a:0.5933},
  {v:"MENTAL2",ty:"POL",t:"Local governments should be allowed to mandate treatment for homeless individuals with severe mental illness or addiction.",t3b:[0.6110,0.5110,0.4960,0.5070,0.5890,0.5260,0.6400,0.5590,0.5550,0.4890,0.7670,0.7710,0.5670,0.7010,0.5940,0.7740],a:0.6284},
  {v:"M4A",ty:"POL",t:"Health insurance should be provided through a single national health insurance system run by the government.",t3b:[0.2390,0.2230,0.1730,0.1440,0.2860,0.4700,0.2680,0.4060,0.2680,0.2440,0.8150,0.5920,0.4020,0.5070,0.3580,0.6670],a:0.4242},
];

// ─── EXPERIENTIAL DATA ───────────────────────────────────────────────────────
const EXP_DATA = [
  {l:"Any UM Experience",v:[0.211,0.129,0.147,0.117,0.182,0.240,0.204,0.201,0.184,0.184,0.204,0.242,0.239,0.196,0.221,0.153]},
  {l:"Claim Denied",v:[0.075,0.074,0.118,0.095,0.109,0.140,0.104,0.119,0.148,0.156,0.152,0.190,0.154,0.130,0.149,0.120]},
  {l:"Prior Auth Delay",v:[0.152,0.100,0.066,0.090,0.158,0.184,0.147,0.180,0.088,0.113,0.123,0.162,0.192,0.131,0.156,0.097]},
  {l:"Surprise Bill",v:[0.248,0.261,0.249,0.230,0.287,0.283,0.275,0.326,0.302,0.329,0.316,0.310,0.276,0.226,0.268,0.202]},
  {l:"Hospital Closure",v:[0.077,0.051,0.041,0.042,0.016,0.118,0.027,0.115,0.060,0.097,0.070,0.050,0.026,0.065,0.079,0.040]},
  {l:"Telehealth Used",v:[0.278,0.292,0.346,0.233,0.332,0.313,0.308,0.272,0.261,0.272,0.426,0.360,0.289,0.328,0.295,0.348]},
  {l:"Recent Diagnosis",v:[0.117,0.128,0.141,0.127,0.123,0.152,0.127,0.172,0.128,0.144,0.164,0.155,0.132,0.136,0.235,0.144]},
];

// ─── INSURANCE COVERAGE DATA ────────────────────────────────────────────────
const INSURANCE_TYPE = [
  {l:"Employer",       v:[0.398,0.522,0.512,0.434,0.511,0.404,0.473,0.438,0.415,0.479,0.550,0.426,0.465,0.467,0.416,0.403]},
  {l:"Individual/Exchange",v:[0.165,0.109,0.125,0.137,0.114,0.220,0.153,0.150,0.167,0.145,0.110,0.141,0.151,0.142,0.168,0.148]},
  {l:"Medicaid",       v:[0.096,0.051,0.032,0.068,0.083,0.149,0.122,0.188,0.088,0.137,0.133,0.179,0.180,0.166,0.075,0.113]},
  {l:"Medicare (traditional)",v:[0.156,0.089,0.075,0.106,0.082,0.083,0.068,0.042,0.081,0.072,0.054,0.050,0.045,0.078,0.137,0.105]},
  {l:"Medicare Advantage",  v:[0.100,0.118,0.194,0.155,0.129,0.123,0.120,0.118,0.151,0.081,0.078,0.138,0.063,0.107,0.146,0.161]},
  {l:"Other",          v:[0.085,0.112,0.061,0.100,0.080,0.021,0.064,0.064,0.098,0.086,0.075,0.067,0.097,0.040,0.057,0.069]},
];
const GOP_PODS = [
  {l:"Joe Rogan",v:[0.165,0.194,0.173,0.198,0.146,0.220,0.152,0.145,0.156,0.148,0.039,0.079,0.084,0.095,0.083,0.024]},
  {l:"Dan Bongino",v:[0.169,0.048,0.077,0.107,0.029,0.077,0.073,0.053,0.064,0.103,0,0,0,0,0,0]},
  {l:"Charlie Kirk",v:[0.188,0.088,0.075,0.177,0.044,0.135,0.110,0.074,0.102,0.163,0,0,0,0,0,0]},
  {l:"Megyn Kelly",v:[0.186,0.080,0.069,0.109,0.032,0.088,0.107,0.081,0.043,0.098,0,0,0,0,0,0]},
  {l:"Daily Wire",v:[0.090,0.094,0.069,0.088,0.035,0.080,0.078,0.085,0.063,0.065,0,0,0,0,0,0]},
  {l:"Mark Levin",v:[0.102,0.048,0.113,0.122,0.021,0.045,0.074,0.060,0.063,0.055,0,0,0,0,0,0]},
  {l:"Matt Walsh",v:[0.093,0.072,0.050,0.073,0.005,0.027,0.040,0.078,0.072,0.059,0,0,0,0,0,0]},
  {l:"Jordan Peterson",v:[0.047,0.025,0.061,0.047,0.027,0.097,0.059,0.031,0.054,0.033,0,0,0,0,0,0]},
  {l:"Del Bigtree",v:[0.009,0.013,0.006,0.005,0.009,0.011,0.087,0.044,0.009,0.086,0,0,0,0,0,0]},
];
const DEM_PODS = [
  {l:"Rachel Maddow",v:[0,0,0,0,0,0,0,0,0,0,0.127,0.070,0.048,0.060,0.028,0.114]},
  {l:"NPR Up First",v:[0,0,0,0,0,0,0,0,0,0,0.097,0.048,0.042,0.063,0.055,0.067]},
  {l:"Joe Rogan",v:[0,0,0,0,0,0,0,0,0,0,0.039,0.079,0.084,0.095,0.083,0.024]},
  {l:"David Pakman",v:[0,0,0,0,0,0,0,0,0,0,0.070,0.029,0.018,0.041,0.023,0.043]},
  {l:"Pod Save America",v:[0,0,0,0,0,0,0,0,0,0,0.067,0.065,0.010,0.057,0.069,0.100]},
  {l:"The Daily (NYT)",v:[0,0,0,0,0,0,0,0,0,0,0.063,0.045,0.040,0.073,0.064,0.053]},
  {l:"Majority Report",v:[0,0,0,0,0,0,0,0,0,0,0.042,0.045,0.005,0.008,0.024,0.029]},
  {l:"Ezra Klein",v:[0,0,0,0,0,0,0,0,0,0,0.036,0.019,0.003,0.029,0.018,0.032]},
];
const NEWS = [
  {l:"Fox News",v:[0.530,0.605,0.602,0.564,0.448,0.495,0.538,0.293,0.511,0.454,0.026,0.148,0.126,0.202,0.136,0.075]},
  {l:"CNN",v:[0.172,0.172,0.167,0.113,0.194,0.286,0.171,0.223,0.142,0.130,0.379,0.506,0.359,0.488,0.453,0.537]},
  {l:"MSNBC",v:[0.071,0.080,0.071,0.074,0.170,0.223,0.089,0.099,0.110,0.090,0.326,0.320,0.216,0.258,0.222,0.432]},
  {l:"NYT",v:[0.110,0.114,0.072,0.058,0.090,0.187,0.131,0.146,0.110,0.155,0.305,0.235,0.200,0.217,0.245,0.322]},
  {l:"WSJ",v:[0.203,0.137,0.143,0.126,0.156,0.125,0.116,0.137,0.132,0.111,0.131,0.125,0.127,0.133,0.208,0.163]},
  {l:"Newsmax",v:[0.149,0.171,0.139,0.237,0.084,0.215,0.208,0.100,0.204,0.224,0.000,0.015,0.013,0.031,0.019,0.043]},
  {l:"Politico",v:[0.083,0.045,0.031,0.047,0.050,0.121,0.037,0.059,0.047,0.046,0.176,0.105,0.075,0.092,0.123,0.160]},
  {l:"Breitbart",v:[0.076,0.029,0.037,0.069,0.032,0.096,0.053,0.021,0.069,0.122,0.001,0.006,0.003,0.000,0.010,0.005]},
  {l:"The Atlantic",v:[0.025,0.012,0.023,0.031,0.015,0.135,0.027,0.092,0.028,0.036,0.148,0.096,0.045,0.058,0.088,0.153]},
];

// ─── WELLNESS ORIENTATION DATA ───────────────────────────────────────────────
const WELL_ORIENT = [
  {l:"US much less healthy than others",v:[0.121,0.096,0.081,0.229,0.166,0.098,0.261,0.134,0.204,0.349,0.481,0.312,0.321,0.148,0.190,0.234]},
  {l:"Nutrition access barrier",v:[0.250,0.204,0.177,0.178,0.400,0.286,0.146,0.394,0.287,0.188,0.269,0.407,0.298,0.264,0.291,0.361]},
  {l:"Culture doesn't encourage health",v:[0.452,0.378,0.651,0.430,0.269,0.314,0.238,0.250,0.292,0.207,0.402,0.237,0.312,0.481,0.573,0.474]},
  {l:"Big Pharma causing chronic disease",v:[0.183,0.127,0.093,0.274,0.094,0.173,0.238,0.122,0.263,0.305,0.191,0.125,0.168,0.123,0.057,0.102]},
  {l:"Big Food selling unhealthy products",v:[0.250,0.356,0.167,0.236,0.279,0.237,0.296,0.302,0.251,0.297,0.399,0.249,0.359,0.283,0.364,0.263]},
  {l:"Food additives harming health",v:[0.544,0.563,0.495,0.557,0.576,0.429,0.570,0.529,0.521,0.574,0.369,0.557,0.499,0.408,0.428,0.335]},
  {l:"GMOs harming long-term health",v:[0.173,0.151,0.070,0.072,0.202,0.144,0.264,0.168,0.153,0.187,0.055,0.115,0.086,0.083,0.047,0.040]},
];
const WELL_LIFE = [
  {l:"Buy organic food regularly",v:[0.322,0.225,0.276,0.339,0.253,0.305,0.427,0.482,0.343,0.510,0.480,0.395,0.416,0.343,0.439,0.493]},
  {l:"Take dietary supplements",v:[0.751,0.771,0.767,0.787,0.714,0.703,0.718,0.528,0.763,0.735,0.731,0.727,0.700,0.619,0.691,0.793]},
  {l:"Follow a named diet plan",v:[0.158,0.107,0.099,0.125,0.110,0.174,0.225,0.234,0.080,0.177,0.128,0.148,0.136,0.090,0.142,0.149]},
  {l:"Go to a gym regularly",v:[0.293,0.297,0.320,0.269,0.240,0.422,0.259,0.268,0.291,0.321,0.253,0.249,0.302,0.255,0.377,0.277]},
  {l:"Wear a fitness tracker",v:[0.408,0.389,0.420,0.393,0.417,0.362,0.339,0.405,0.314,0.340,0.396,0.423,0.435,0.385,0.397,0.400]},
  {l:"Meditate or pray for health",v:[0.492,0.334,0.463,0.639,0.321,0.340,0.594,0.457,0.431,0.454,0.328,0.588,0.422,0.337,0.399,0.292]},
  {l:"Read ingredient labels",v:[0.587,0.588,0.607,0.697,0.577,0.584,0.717,0.660,0.662,0.750,0.720,0.660,0.651,0.557,0.672,0.717]},
  {l:"Use alternative medicine",v:[0.046,0.071,0.061,0.096,0.025,0.179,0.130,0.179,0.047,0.148,0.049,0.068,0.098,0.055,0.149,0.078]},
  {l:"Follow nutrition social media",v:[0.139,0.116,0.117,0.150,0.159,0.346,0.236,0.230,0.147,0.233,0.125,0.205,0.127,0.155,0.229,0.131]},
  {l:"Spend money on alternative therapies",v:[0.126,0.105,0.158,0.211,0.157,0.252,0.205,0.235,0.208,0.218,0.174,0.209,0.191,0.097,0.153,0.134]},
];

// ─── HBIS INDEX (avg count of health behavior activities) ───────────────────
const HBIS_SUM = [3.32,3.00,3.29,3.71,2.97,3.67,3.85,3.68,3.29,3.88,3.38,3.67,3.48,2.89,3.65,3.46];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function popAvg(arr) {
  return SEGMENTS.reduce((s,g,i) => s+g.pop*arr[i], 0) / POP_T;
}

// ─── BLENDED DISTINCTIVENESS SCORING ─────────────────────────────────────────
// Precompute party-level stats for each belief item
const GOP_IDX = SEGMENTS.map((s,i)=>[s,i]).filter(([s])=>s.party==="GOP").map(([,i])=>i);
const DEM_IDX = SEGMENTS.map((s,i)=>[s,i]).filter(([s])=>s.party==="DEM").map(([,i])=>i);
const GOP_POP = GOP_IDX.reduce((s,i)=>s+SEGMENTS[i].pop,0);
const DEM_POP = DEM_IDX.reduce((s,i)=>s+SEGMENTS[i].pop,0);

function weightedMean(arr, idxs, pops) {
  const tot = idxs.reduce((s,i) => s + pops[i], 0);
  return idxs.reduce((s,i) => s + pops[i] * arr[i], 0) / tot;
}
function weightedSD(arr, idxs, pops, mean) {
  const tot = idxs.reduce((s,i) => s + pops[i], 0);
  const variance = idxs.reduce((s,i) => s + pops[i] * (arr[i] - mean) ** 2, 0) / tot;
  return Math.sqrt(variance) || 0.001; // floor to avoid div/0
}
const SD_FLOOR = 0.05; // prevent tiny-SD items from inflating z-scores

const BELIEF_STATS = BELIEFS.map(b => {
  const popW = SEGMENTS.map(s => s.pop);
  // All-population stats
  const allMean = b.a;
  const allSD = weightedSD(b.t3b, SEGMENTS.map((_,i)=>i), popW, allMean);
  // Party stats
  const gopMean = weightedMean(b.t3b, GOP_IDX, popW);
  const gopSD = Math.max(weightedSD(b.t3b, GOP_IDX, popW, gopMean), SD_FLOOR);
  const demMean = weightedMean(b.t3b, DEM_IDX, popW);
  const demSD = Math.max(weightedSD(b.t3b, DEM_IDX, popW, demMean), SD_FLOOR);
  return { allMean, allSD, gopMean, gopSD, demMean, demSD };
});

// ─── CURATED DISCRIMINATING ITEMS PER SEGMENT ───────────────────────────────
const SEGMENT_BELIEFS = {
  TSP: ["RURAL_SUBSIDY","OPIOIDS","WORK_REQ","CLINICIAN_AUTONOMY"],
  CEC: ["EQUITY_FUNDING","MEDICAID","VAX_SAFETY","HEALTH_DISC"],
  TC:  ["WOKE","GENDER","PROFIT","OPIOIDS"],
  WE:  ["WHO_POLICY","MANDATE_POLICY","CLINICIAN_AUTONOMY","IMMIG"],
  PP:  ["PROFIT","PHARMA_IP","INFLUENCE","OPIOIDS"],
  HF:  ["AI_REG","DATA_PORT","GENDER_CARE","LONGEVITY_POLICY"],
  PFF: ["RED_MEAT","MANDATE_POLICY","FLUORIDE","ELITES"],
  HHN: ["IMMUNITY","NATUROPATHIC","REFUSAL","MRNA"],
  MFL: ["MED_LIBERTY","GENDER_CARE","EQUITY_FUNDING","NIH_FUND"],
  VS:  ["VAX_SAFETY","MANDATE_POLICY","ELITES","MRNA"],
  UCP: ["GENDER_CARE","MEDICAID","MENTAL1","INFLUENCE"],
  FJP: ["EQUITY_FUNDING","NATAL_POLICY","VAX_SAFETY","SDOH"],
  HCP: ["PROFIT","UNION_PLAN","BUILD_THAT","OPIOIDS"],
  HAD: ["LONGEVITY_POLICY","INDIVID_RESP","PROFIT","AI_REG"],
  HCI: ["NIH_FUND","MRNA","EXPERIMENTAL_RX","M4A"],
  GHI: ["WOKE","WHO_POLICY","ELITES","GENDER_CARE"],
};

const BELIEFS_BY_VAR = {};
BELIEFS.forEach(b => { BELIEFS_BY_VAR[b.v] = b; });

function getTopBeliefs(segIdx) {
  const seg = SEGMENTS[segIdx];
  const party = seg.party;
  const varCodes = SEGMENT_BELIEFS[seg.code] || [];
  return varCodes.map(vc => {
    const b = BELIEFS_BY_VAR[vc];
    if (!b) return null;
    const bi = BELIEFS.indexOf(b);
    const st = BELIEF_STATS[bi];
    const val = b.t3b[segIdx];
    const deltaAll = val - st.allMean;
    const partyMean = party === "GOP" ? st.gopMean : st.demMean;
    const deltaParty = val - partyMean;
    return { ...b, delta: deltaAll, deltaParty };
  }).filter(Boolean);
}

function getDistinctive(segIdx) {
  return Object.entries(ENTITIES)
    .map(([k,e]) => ({ k, l:e.l, val:e.v[segIdx], avg:e.a, delta:+(e.v[segIdx]-e.a).toFixed(2) }))
    .sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta))
    .slice(0,3);
}

// ─── SEGMENT SELECTOR ────────────────────────────────────────────────────────
function SegSel({ sel, onChange }) {
  const gop = SEGMENTS.map((s,i)=>[s,i]).filter(([s])=>s.party==="GOP").map(([,i])=>i);
  const dem = SEGMENTS.map((s,i)=>[s,i]).filter(([s])=>s.party==="DEM").map(([,i])=>i);
  const btn = i => {
    const s=SEGMENTS[i], act=i===sel, pc=s.party==="GOP"?CP.partyGOP:CP.partyDEM;
    return <button key={s.code} onClick={()=>onChange(i)} style={{
      padding:"5px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,
      fontWeight:act?700:500,fontFamily:"'DM Sans',sans-serif",
      background:act?`${pc}22`:"transparent",color:act?pc:CP.textMuted,
      outline:act?`1.5px solid ${pc}55`:"1px solid transparent",transition:"all .15s",
    }}>{s.code}</button>;
  };
  return <div>
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
      <span style={{fontSize:9,color:CP.partyGOP,fontWeight:700,letterSpacing:1,textTransform:"uppercase",lineHeight:"28px",marginRight:4}}>GOP</span>
      {gop.map(btn)}
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      <span style={{fontSize:9,color:CP.partyDEM,fontWeight:700,letterSpacing:1,textTransform:"uppercase",lineHeight:"28px",marginRight:4}}>DEM</span>
      {dem.map(btn)}
    </div>
  </div>;
}

// ─── HORIZONTAL BAR ──────────────────────────────────────────────────────────
function HBar({ label, value, avg, color, maxVal=1 }) {
  const pct = v => Math.max(0, Math.min(100, (v/maxVal)*100));
  const delta = value - avg;
  return <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"baseline"}}>
      <span style={{fontSize:11,fontWeight:600,color:CP.text}}>{label}</span>
      <span style={{fontSize:11}}>
        <span style={{color:CP.white,fontWeight:700}}>{(value*100).toFixed(0)}%</span>
        {" "}
        <span style={{fontSize:9,color:delta>=0?CP.green:CP.red}}>
          {delta>=0?"+":""}{(delta*100).toFixed(0)} vs avg
        </span>
      </span>
    </div>
    <div style={{position:"relative",height:18,background:CP.dotStrip,borderRadius:3}}>
      <div style={{position:"absolute",top:0,left:0,height:14,width:`${pct(value)}%`,
        background:`${color}88`,borderRadius:3}} />
      <div style={{position:"absolute",top:0,left:`${pct(avg)}%`,width:2,height:14,
        background:CP.steel,opacity:0.5,transform:"translateX(-1px)"}} />
      <div style={{position:"absolute",top:14,left:`${pct(avg)}%`,transform:"translateX(-50%)",
        fontSize:7,color:CP.textDim,whiteSpace:"nowrap"}}>avg {(avg*100).toFixed(0)}%</div>
    </div>
  </div>;
}

// ─── NICE VARIABLE NAMES ─────────────────────────────────────────────────────
const NICE_NAMES = {
  CHOICE:"Health Autonomy", PROFIT:"Pharma Profits Over Patients", INDIVID_RESP:"Individual Responsibility",
  IMMUNITY:"Natural Immunity", ELITES:"Anti-Expert Sentiment", EQUITY_FUNDING:"Health Equity Funding",
  REFUSAL:"Right to Refuse Treatment", INFLUENCE:"Corporate Influence", CLINICIAN_AUTONOMY:"Clinician Conscience",
  DATA_PORT:"Data Portability", MED_LIBERTY:"Medical Liberty", GENDER:"Minor Gender Restrictions",
  WOKE:"Anti-Woke / ESG", MRNA:"mRNA Safety Doubts", FLUORIDE:"Fluoride Removal",
  VAX_SAFETY:"Vaccine Safety Doubts", OPIOIDS:"Pharma Opioid Blame", RWE:"Real-World Evidence",
  BODY_SANCTITY:"Body Sanctity", AI_REG:"AI Regulation", NATURAL_ORDER:"Natural Order",
  BUILD_THAT:"NIH Built Breakthroughs", PRO_MARRIAGE:"Pro-Marriage Incentives", PHARMA_IP:"Patent Abuse",
  RED_MEAT:"Red Meat Healthier", CLINICAL_TRIALS:"Clinical Trial Distrust", NATUROPATHIC:"Naturopathic Remedies",
  SDOH:"Social Determinants", EXPERIMENTAL_RX:"Right to Try",
  M4A:"Medicare for All", WORK_REQ:"Work Requirements", NIH_FUND:"NIH / CDC Funding",
  ESI_REQ:"Employer Insurance Mandate", PUBLIC_OPTION:"Public Option", WHO_POLICY:"Leave the WHO",
  MEDICAID:"Protect Medicaid", GENDER_CARE:"Gender-Affirming Coverage", GMO_LABEL:"GMO Labeling",
  MENTAL1:"Community Mental Health Funding", MANDATE_POLICY:"Pandemic Immunity Policy",
  UNION_PLAN:"Protect Union Plans", MED_NEGOT:"Medicare Drug Negotiation",
  ANTI_ESI:"End Employer Insurance", MA:"Protect Medicare Advantage", EARLY_ACCESS:"Terminally Ill Access",
  DATA_OWNERSHIP:"Health Data Ownership", LONGEVITY_POLICY:"Longevity Research", HEALTH_DISC:"Healthy Behavior Discount",
  RURAL_SUBSIDY:"Rural Hospital Subsidies", NATAL_POLICY:"Pro-Natalist Policy", IMMIG:"Immigration Health Jobs",
  MENTAL2:"Mandated Mental Health Treatment",
};

// ─── DONUT CHART ─────────────────────────────────────────────────────────────
function ProfDonut({ value, avg, color, size=96 }) {
  const r = 34, cx=48, cy=48, sw=8;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.max(0, Math.min(1, value));
  const gap = circ - filled;
  // Avg tick position on the arc (from 12 o'clock)
  const avgFrac = Math.max(0, Math.min(1, avg));
  const avgAng = (-90 + avgFrac * 360) * (Math.PI / 180);
  const tx = cx + r * Math.cos(avgAng);
  const ty = cy + r * Math.sin(avgAng);
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" style={{display:"block",flexShrink:0}}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={CP.dotStrip} strokeWidth={sw} />
      {/* Filled arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${filled} ${gap}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{transition:"stroke-dasharray 0.4s ease"}} />
      {/* Avg marker */}
      <circle cx={tx} cy={ty} r={4} fill={CP.bg} stroke={CP.steel} strokeWidth={1.5} />
      {/* Center percentage */}
      <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central"
        fill={CP.white} fontSize="19" fontWeight="800"
        style={{fontFamily:"'DM Sans',sans-serif"}}>{(value * 100).toFixed(0)}%</text>
    </svg>
  );
}

// ─── INSURANCE REFORM PREFERENCE DATA ────────────────────────────────────────
const INS_REFORM = [
  {l:"Single Payer",   v:[0.151,0.195,0.133,0.126,0.255,0.424,0.209,0.360,0.205,0.195,0.592,0.443,0.346,0.402,0.299,0.520], score:1, color:"#a78bfa"},
  {l:"Public Option",  v:[0.254,0.161,0.104,0.112,0.180,0.137,0.182,0.151,0.229,0.153,0.355,0.357,0.305,0.301,0.230,0.341], score:2, color:"#22d3ee"},
  {l:"ESI Mandatory",  v:[0.338,0.385,0.441,0.488,0.376,0.149,0.399,0.233,0.373,0.353,0.049,0.135,0.195,0.138,0.349,0.108], score:3, color:"#d4915e"},
  {l:"Status Quo",     v:[0.257,0.258,0.322,0.275,0.189,0.289,0.210,0.256,0.194,0.299,0.004,0.065,0.155,0.160,0.122,0.031], score:4, color:"#8194a8"},
];

// ─── TAB: BELIEFS ────────────────────────────────────────────────────────────
function BeliefsPanel({ segIdx }) {
  const top4 = getTopBeliefs(segIdx);
  const colors = [CP.cyan, CP.violet, CP.rose, CP.amber];
  const party = SEGMENTS[segIdx].party;
  const partyColor = party === "GOP" ? CP.partyGOP : CP.partyDEM;

  // Insurance reform spectrum
  const expandPct = INS_REFORM[0].v[segIdx] + INS_REFORM[1].v[segIdx];
  const preservePct = INS_REFORM[2].v[segIdx] + INS_REFORM[3].v[segIdx];
  const leanLabel = expandPct > preservePct + 0.10 ? "Leans Expand"
    : preservePct > expandPct + 0.10 ? "Leans Preserve"
    : "Mixed / Split";
  const leanColor = expandPct > preservePct + 0.10 ? "#a78bfa"
    : preservePct > expandPct + 0.10 ? "#d4915e"
    : CP.steel;

  return (
    <div>
      {/* ═══ WHAT THEY WANT — Own Panel ═══ */}
      <div style={{padding:"24px 28px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
          <div style={{fontSize:16,fontWeight:800,color:CP.white,letterSpacing:0.5}}>
            WHAT THEY WANT
          </div>
          <div style={{fontSize:12,fontWeight:700,color:leanColor}}>{leanLabel}</div>
        </div>
        <div style={{fontSize:11,color:CP.textMuted,fontWeight:500,marginBottom:16}}>
          Preferred direction for U.S. health insurance reform
        </div>

        {/* Legend — prominent, above bars */}
        <div style={{display:"flex",gap:16,marginBottom:14}}>
          {INS_REFORM.map((cat, ci) => (
            <div key={ci} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:12,height:12,borderRadius:3,background:cat.color}} />
              <span style={{fontSize:11,fontWeight:600,color:cat.color}}>{cat.l}</span>
            </div>
          ))}
        </div>

        {/* Segment bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div style={{fontSize:9,fontWeight:700,color:CP.white,width:50,textAlign:"right",flexShrink:0}}>Segment</div>
          <div style={{flex:1,display:"flex",height:32,borderRadius:6,overflow:"hidden"}}>
            {INS_REFORM.map((cat, ci) => {
              const pct = cat.v[segIdx] * 100;
              return <div key={ci} style={{
                width:`${pct}%`,height:"100%",background:cat.color,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                {pct >= 8 && <span style={{fontSize:11,fontWeight:700,color:"#0f1a2e",
                  textShadow:"0 0 4px rgba(255,255,255,0.3)"}}>{pct.toFixed(0)}%</span>}
              </div>;
            })}
          </div>
        </div>

        {/* Population bar */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:600,color:CP.textDim,width:50,textAlign:"right",flexShrink:0}}>Pop avg</div>
          <div style={{flex:1,display:"flex",height:16,borderRadius:4,overflow:"hidden",opacity:0.55}}>
            {INS_REFORM.map((cat, ci) => {
              const pct = popAvg(cat.v) * 100;
              return <div key={ci} style={{
                width:`${pct}%`,height:"100%",background:cat.color,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                {pct >= 10 && <span style={{fontSize:8,fontWeight:700,color:"#0f1a2e"}}>{pct.toFixed(0)}%</span>}
              </div>;
            })}
          </div>
        </div>

        {/* Spectrum endpoints */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          paddingTop:8,borderTop:`1px solid ${CP.cardBorder}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:9,color:"#a78bfa",fontWeight:600}}>← Expand Coverage</span>
            <span style={{fontSize:8,color:CP.textDim}}>({(expandPct*100).toFixed(0)}%)</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:8,color:CP.textDim}}>({(preservePct*100).toFixed(0)}%)</span>
            <span style={{fontSize:9,color:"#d4915e",fontWeight:600}}>Preserve Market →</span>
          </div>
        </div>
      </div>

      {/* ═══ WHAT THEY BELIEVE — Cards Panel ═══ */}
      <div style={{padding:"24px 28px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:CP.white,letterSpacing:0.5,marginBottom:2}}>
            WHAT THEY BELIEVE
          </div>
          <div style={{fontSize:11,color:CP.textMuted,fontWeight:500}}>
            Top discriminating attitudes &amp; policies
          </div>
        </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
        {top4.map((b, i) => {
          const isUp = b.delta > 0;
          const ac = isUp ? CP.green : CP.red;
          const niceName = NICE_NAMES[b.v] || b.v;
          const isPartyUp = b.deltaParty > 0;
          const pac = isPartyUp ? CP.green : CP.red;
          return (
            <div key={i} style={{
              flex:"1 1 220px", minWidth:220, maxWidth:"100%",
              padding:"20px 18px 16px", borderRadius:10,
              background:CP.bg, border:`1px solid ${colors[i]}30`,
              position:"relative", display:"flex", flexDirection:"column",
            }}>
              {/* Left accent bar */}
              <div style={{position:"absolute",top:8,left:0,width:3,height:"calc(100% - 16px)",
                background:colors[i],borderRadius:3}} />

              {/* Title */}
              <div style={{fontSize:13,fontWeight:700,color:colors[i],marginBottom:14,lineHeight:1.3,
                paddingLeft:4}}>
                {niceName}
              </div>

              {/* Donut + dual deltas */}
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,paddingLeft:4}}>
                <ProfDonut value={b.t3b[segIdx]} avg={b.a} color={colors[i]} />
                <div>
                  {/* vs all population */}
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                    <svg width="12" height="12" viewBox="0 0 14 14"
                      style={{transform:isUp?"none":"rotate(180deg)",flexShrink:0}}>
                      <path d="M7 1 L13 11 L1 11 Z" fill={ac} />
                    </svg>
                    <span style={{fontSize:19,fontWeight:800,color:ac,fontFamily:"'DM Sans',sans-serif"}}>
                      {isUp ? "+" : ""}{(b.delta * 100).toFixed(0)}
                    </span>
                    <span style={{fontSize:9,color:CP.textDim}}>vs pop</span>
                  </div>
                  {/* vs own party */}
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <svg width="10" height="10" viewBox="0 0 14 14"
                      style={{transform:isPartyUp?"none":"rotate(180deg)",flexShrink:0}}>
                      <path d="M7 1 L13 11 L1 11 Z" fill={pac} />
                    </svg>
                    <span style={{fontSize:13,fontWeight:700,color:pac,fontFamily:"'DM Sans',sans-serif"}}>
                      {isPartyUp ? "+" : ""}{(b.deltaParty * 100).toFixed(0)}
                    </span>
                    <span style={{fontSize:9,color:CP.textDim}}>vs {party}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{fontSize:10.5,color:CP.textMuted,lineHeight:1.5,flex:1,paddingLeft:4}}>
                {b.t}
              </div>

              {/* T2B footnote */}
              <div style={{fontSize:8,color:CP.textDim,marginTop:10,paddingTop:8,
                borderTop:`1px solid ${CP.cardBorder}`,paddingLeft:4}}>
                Top-3-box · Somewhat Agree + Agree + Strongly Agree on 7-pt scale
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

// ─── TAB: TRUST ──────────────────────────────────────────────────────────────
function TrustPanel({ segIdx }) {
  const govt=TRUST_DATA.GOVT[segIdx], corp=TRUST_DATA.CORP[segIdx], gap=TRUST_DATA.GAP[segIdx];
  const pct=v=>((v-1)/6)*100;
  const gP=pct(govt), cP=pct(corp), aG=pct(AVG_G), aC=pct(AVG_C);
  const lo=Math.min(gP,cP), hi=Math.max(gP,cP);
  const mid=(govt+corp)/2, aMid=(AVG_G+AVG_C)/2;
  const posture=mid>aMid+.25?"High-trust":mid<aMid-.25?"Low-trust":"Moderate-trust";
  const gapLbl=gap>GAP_AVG+.3?"wide gap":gap<GAP_AVG-.2?"narrow gap":"typical gap";
  const pC=mid>aMid+.25?CP.green:mid<aMid-.25?CP.red:CP.textMuted;

  const DotStrip2 = ({title,color,ents}) => <div style={{flex:1,padding:"14px 18px",background:CP.bg,borderRadius:8,border:`1px solid ${CP.cardBorder}`}}>
    <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:6,height:6,borderRadius:3,background:color}} />{title}
    </div>
    {ents.map(k => {
      const e=ENTITIES[k]; const sv=e.v[segIdx]; const d=sv-e.a;
      return <div key={k} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"baseline"}}>
          <span style={{fontSize:11,fontWeight:600,color:CP.text}}>{e.l}</span>
          <span style={{fontSize:10}}>
            <span style={{color:CP.white,fontWeight:700}}>{sv.toFixed(1)}</span>{" "}
            <span style={{fontSize:9,color:d>=0?CP.green:CP.red}}>{d>=0?"+":""}{d.toFixed(2)}</span>
          </span>
        </div>
        <div style={{position:"relative",height:16}}>
          <div style={{position:"absolute",top:6,left:0,right:0,height:4,borderRadius:2,background:CP.dotStrip}} />
          <div style={{position:"absolute",top:2,left:`${pct(e.a)}%`,transform:"translateX(-50%)",width:1.5,height:12,background:CP.steel,opacity:.3}} />
          <div style={{position:"absolute",top:3,left:`${pct(sv)}%`,transform:"translateX(-50%)",width:10,height:10,borderRadius:5,background:color,border:`2px solid ${CP.white}`,boxShadow:`0 0 6px ${color}55`}} />
        </div>
      </div>;
    })}
    <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:CP.textDim,marginTop:4,paddingTop:4,borderTop:`1px solid ${CP.cardBorder}`}}>
      <span>1 No trust</span><span>7 High trust</span>
    </div>
  </div>;

  return <div>
    {/* Dumbbell */}
    <div style={{padding:"18px 22px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.textMuted}}>Trust Posture</div>
        <div style={{fontSize:10,color:pC,fontWeight:600}}>{posture} · {gapLbl}</div>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:8,height:8,borderRadius:4,background:CP.govtBlue}} />
          <span style={{fontSize:12,color:CP.textMuted}}>Govt</span>
          <span style={{fontSize:24,fontWeight:800,color:CP.white,fontFamily:"'DM Sans',sans-serif"}}>{govt.toFixed(2)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:8,height:8,borderRadius:4,background:CP.corpAmber}} />
          <span style={{fontSize:12,color:CP.textMuted}}>Corp</span>
          <span style={{fontSize:24,fontWeight:800,color:CP.white,fontFamily:"'DM Sans',sans-serif"}}>{corp.toFixed(2)}</span>
        </div>
        <span style={{fontSize:12,color:CP.textMuted}}>Gap <span style={{fontSize:16,fontWeight:700,color:CP.steel}}>{gap.toFixed(2)}</span>
          <span style={{fontSize:10,color:CP.textDim,marginLeft:4}}>avg {GAP_AVG.toFixed(2)}</span></span>
      </div>
      <div style={{position:"relative",height:50,marginBottom:6}}>
        <div style={{position:"absolute",top:18,left:0,right:0,height:8,borderRadius:4,background:CP.dotStrip,border:`1px solid ${CP.cardBorder}`}} />
        <div style={{position:"absolute",top:20,left:`${Math.min(aG,aC)}%`,width:`${Math.abs(aG-aC)}%`,height:4,borderRadius:2,background:`${CP.steel}20`}} />
        <div style={{position:"absolute",top:16,left:`${aG}%`,transform:"translateX(-50%)",width:10,height:10,borderRadius:5,background:`${CP.govtBlue}30`,border:`1.5px dashed ${CP.govtBlue}50`}} />
        <div style={{position:"absolute",top:16,left:`${aC}%`,transform:"translateX(-50%)",width:10,height:10,borderRadius:5,background:`${CP.corpAmber}30`,border:`1.5px dashed ${CP.corpAmber}50`}} />
        <div style={{position:"absolute",top:20,left:`${lo}%`,width:`${hi-lo}%`,height:4,borderRadius:2,background:`linear-gradient(to right,${CP.corpAmber}88,${CP.govtBlue}88)`}} />
        <div style={{position:"absolute",top:13,left:`${cP}%`,transform:"translateX(-50%)",width:16,height:16,borderRadius:8,background:CP.corpAmber,border:`2px solid ${CP.white}`,boxShadow:`0 0 8px ${CP.corpAmber}55`,zIndex:3}} />
        <div style={{position:"absolute",top:1,left:`${cP}%`,transform:"translateX(-50%)",fontSize:9,fontWeight:700,color:CP.corpAmber}}>{corp.toFixed(1)}</div>
        <div style={{position:"absolute",top:13,left:`${gP}%`,transform:"translateX(-50%)",width:16,height:16,borderRadius:8,background:CP.govtBlue,border:`2px solid ${CP.white}`,boxShadow:`0 0 8px ${CP.govtBlue}55`,zIndex:3}} />
        <div style={{position:"absolute",top:1,left:`${gP}%`,transform:"translateX(-50%)",fontSize:9,fontWeight:700,color:CP.govtBlue}}>{govt.toFixed(1)}</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:CP.textDim}}>
        <span>1 No trust</span><span>7 High trust</span>
      </div>
    </div>
    {/* Entity strips */}
    <div style={{display:"flex",gap:12,marginBottom:12}}>
      <DotStrip2 title="Corporate / Market" color={CP.corpAmber} ents={["PHARMA","INSURER","HOSPITAL","PROVIDER"]} />
      <DotStrip2 title="Government / Institutional" color={CP.govtBlue} ents={["MEDICARE","NIH","FED","ACADEMIA"]} />
    </div>
    {/* Distinctive institutions */}
    {(() => {
      const top3 = getDistinctive(segIdx);
      const dColors = [CP.cyan, CP.violet, CP.rose];
      return <div style={{padding:"18px 22px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.textMuted,marginBottom:14}}>
          Most Distinctive Trust Gaps
        </div>
        <div style={{display:"flex",gap:12}}>
          {top3.map((d, i) => {
            const isUp = d.delta >= 0;
            const ac = isUp ? CP.green : CP.red;
            return <div key={d.k} style={{flex:1,padding:"14px 16px",background:CP.bg,borderRadius:8,border:`1px solid ${dColors[i]}30`,position:"relative"}}>
              <div style={{position:"absolute",top:6,left:0,width:3,height:"calc(100% - 12px)",background:dColors[i],borderRadius:3}} />
              <div style={{fontSize:12,fontWeight:700,color:dColors[i],marginBottom:8,paddingLeft:4}}>{d.l}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6,paddingLeft:4}}>
                <span style={{fontSize:22,fontWeight:800,color:CP.white,fontFamily:"'DM Sans',sans-serif"}}>{d.val.toFixed(2)}</span>
                <svg width="10" height="10" viewBox="0 0 14 14" style={{transform:isUp?"none":"rotate(180deg)",flexShrink:0}}>
                  <path d="M7 1 L13 11 L1 11 Z" fill={ac} />
                </svg>
                <span style={{fontSize:14,fontWeight:700,color:ac}}>{isUp?"+":""}{d.delta.toFixed(2)}</span>
                <span style={{fontSize:9,color:CP.textDim}}>vs pop avg {d.avg.toFixed(2)}</span>
              </div>
            </div>;
          })}
        </div>
      </div>;
    })()}
  </div>;
}

// ─── TAB: EXPERIENTIAL ───────────────────────────────────────────────────────
function ExpPanel({ segIdx }) {
  const um = EXP_DATA[0]; // Any UM
  const deny = EXP_DATA[1]; // Claim Denied
  const prior = EXP_DATA[2]; // Prior Auth
  const surprise = EXP_DATA[3];
  const closure = EXP_DATA[4];
  const tele = EXP_DATA[5];
  const diag = EXP_DATA[6];

  const cards = [
    { d: tele, label: "Telehealth", accent: CP.cyan },
    { d: closure, label: "Hospital Closure", accent: CP.rose },
    { d: diag, label: "Recent Diagnosis", accent: CP.violet },
  ];

  // Semi-circle gauge for UM
  function UMGauge({ value, avg }) {
    const r = 52, cx = 60, cy = 58, sw = 10;
    const halfCirc = Math.PI * r;
    const filled = halfCirc * Math.min(1, value / 0.4);
    const gap = halfCirc - filled;
    const avgFrac = Math.min(1, avg / 0.4);
    const avgAng = Math.PI + avgFrac * Math.PI;
    const tx = cx + r * Math.cos(avgAng);
    const ty = cy + r * Math.sin(avgAng);
    return (
      <svg width={120} height={70} viewBox="0 0 120 70" style={{display:"block",flexShrink:0}}>
        {/* Track */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={CP.dotStrip} strokeWidth={sw} strokeLinecap="round" />
        {/* Filled arc */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={CP.teal} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`} />
        {/* Avg marker */}
        <circle cx={tx} cy={ty} r={4} fill="none" stroke={CP.steel} strokeWidth={1.5} />
        {/* Center text */}
        <text x={cx} y={cy-4} textAnchor="middle" fill={CP.white} fontSize="22" fontWeight="800"
          fontFamily="'DM Sans',sans-serif">{(value*100).toFixed(0)}%</text>
      </svg>
    );
  }

  // Sub-bar for claim denial / prior auth / surprise bill
  function SubBar({ label, value, avg, color }) {
    const pct = v => Math.max(0, Math.min(100, (v/0.4)*100));
    const delta = value - avg;
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"baseline"}}>
          <span style={{fontSize:10,fontWeight:600,color:CP.textMuted}}>{label}</span>
          <span style={{fontSize:10}}>
            <span style={{color:CP.white,fontWeight:700}}>{(value*100).toFixed(0)}%</span>
            {" "}
            <span style={{fontSize:9,color:delta>=0?CP.rose:CP.green}}>
              {delta>=0?"+":""}{(delta*100).toFixed(0)} vs avg
            </span>
          </span>
        </div>
        <div style={{position:"relative",height:14,background:CP.dotStrip,borderRadius:4}}>
          <div style={{position:"absolute",top:0,left:0,height:10,width:`${pct(value)}%`,
            background:`${color}88`,borderRadius:4}} />
          <div style={{position:"absolute",top:-2,left:`${pct(avg)}%`,width:2,height:14,
            background:CP.steel,opacity:0.6,transform:"translateX(-1px)",borderRadius:1}} />
          <div style={{position:"absolute",top:11,left:`${pct(avg)}%`,transform:"translateX(-50%)",
            fontSize:7,color:CP.textDim,whiteSpace:"nowrap"}}>avg {(avg*100).toFixed(0)}%</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:"24px 28px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`,maxWidth:900}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:16,fontWeight:800,color:CP.white,letterSpacing:0.5,marginBottom:2}}>
          HEALTH COVERAGE
        </div>
        <div style={{fontSize:11,color:CP.textMuted,fontWeight:500}}>
          Primary insurance type · segment vs. population average
        </div>
      </div>

      {/* Insurance Coverage HBars */}
      <div style={{background:CP.bg,borderRadius:10,border:`1px solid ${CP.steel}25`,
        padding:"20px 22px",marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.steel,marginBottom:14}}>
          Primary Insurance Type
        </div>
        {INSURANCE_TYPE.map((cat, ci) => {
          const val = cat.v[segIdx];
          const avg = popAvg(cat.v);
          const delta = val - avg;
          const maxVal = 0.60;
          const pct = v => Math.max(0, Math.min(100, (v/maxVal)*100));
          return <div key={ci} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"baseline"}}>
              <span style={{fontSize:11,fontWeight:600,color:CP.text}}>{cat.l}</span>
              <span style={{fontSize:11}}>
                <span style={{color:CP.white,fontWeight:700}}>{(val*100).toFixed(0)}%</span>
                {" "}
                <span style={{fontSize:9,color:delta>=0?CP.green:CP.red}}>
                  {delta>=0?"+":""}{(delta*100).toFixed(0)} vs avg
                </span>
              </span>
            </div>
            <div style={{position:"relative",height:18,background:CP.dotStrip,borderRadius:3}}>
              <div style={{position:"absolute",top:0,left:0,height:14,width:`${pct(val)}%`,
                background:`${CP.steel}88`,borderRadius:3}} />
              <div style={{position:"absolute",top:0,left:`${pct(avg)}%`,width:2,height:14,
                background:CP.steel,opacity:0.5,transform:"translateX(-1px)"}} />
              <div style={{position:"absolute",top:14,left:`${pct(avg)}%`,transform:"translateX(-50%)",
                fontSize:7,color:CP.textDim,whiteSpace:"nowrap"}}>avg {(avg*100).toFixed(0)}%</div>
            </div>
          </div>;
        })}
      </div>

      {/* UM Feature Card */}
      <div style={{background:CP.bg,borderRadius:10,border:`1px solid ${CP.teal}25`,
        padding:"20px 22px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
          <UMGauge value={um.v[segIdx]} avg={popAvg(um.v)} />
          <div>
            <div style={{fontSize:13,fontWeight:700,color:CP.teal,marginBottom:4}}>
              Insurance Friction
            </div>
            <div style={{fontSize:10,color:CP.textMuted,lineHeight:1.4,maxWidth:260}}>
              Negative experience with insurer in past year
            </div>
            <div style={{fontSize:9,color:CP.textDim,marginTop:6}}>
              ○ Pop avg {(popAvg(um.v)*100).toFixed(0)}%
            </div>
          </div>
        </div>
        {/* Sub-components */}
        <div style={{borderTop:`1px solid ${CP.cardBorder}`,paddingTop:12}}>
          <SubBar label="Claim Denied" value={deny.v[segIdx]} avg={popAvg(deny.v)} color={CP.teal} />
          <SubBar label="Prior Auth Delay" value={prior.v[segIdx]} avg={popAvg(prior.v)} color={CP.teal} />
          <SubBar label="Surprise Bill" value={surprise.v[segIdx]} avg={popAvg(surprise.v)} color={CP.teal} />
        </div>
      </div>

      {/* Four individual cards */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
        {cards.map((c, i) => {
          const val = c.d.v[segIdx];
          const avg = popAvg(c.d.v);
          const delta = val - avg;
          const isUp = delta >= 0;
          return (
            <div key={i} style={{
              flex:"1 1 140px",minWidth:140,
              background:CP.bg,borderRadius:10,border:`1px solid ${c.accent}20`,
              padding:"16px 14px",display:"flex",flexDirection:"column",alignItems:"center",
              position:"relative",
            }}>
              {/* Top accent line */}
              <div style={{position:"absolute",top:0,left:16,right:16,height:2,
                background:`linear-gradient(90deg,transparent,${c.accent}60,transparent)`,borderRadius:2}} />
              
              {/* Donut */}
              <ProfDonut value={val} avg={avg} color={c.accent} size={80} />
              
              {/* Label */}
              <div style={{fontSize:11,fontWeight:700,color:c.accent,marginTop:10,textAlign:"center"}}>
                {c.label}
              </div>
              
              {/* Delta */}
              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:6}}>
                <svg width="9" height="9" viewBox="0 0 14 14"
                  style={{transform:isUp?"none":"rotate(180deg)",flexShrink:0}}>
                  <path d="M7 1 L13 11 L1 11 Z" fill={isUp?CP.rose:CP.green} />
                </svg>
                <span style={{fontSize:12,fontWeight:700,color:isUp?CP.rose:CP.green}}>
                  {isUp?"+":""}{(delta*100).toFixed(0)}pp vs avg
                </span>
              </div>
              
              {/* Pop avg */}
              <div style={{fontSize:8,color:CP.textDim,marginTop:4}}>
                pop avg {(avg*100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: MEDIA ──────────────────────────────────────────────────────────────
function MediaPanel({ segIdx }) {
  const seg = SEGMENTS[segIdx];
  const pods = seg.party==="GOP" ? GOP_PODS : DEM_PODS;
  const podLabel = seg.party==="GOP" ? "GOP Podcasts" : "DEM Podcasts";
  const podColor = seg.party==="GOP" ? CP.partyGOP : CP.partyDEM;
  // Sort by this segment's value
  const sortedPods = [...pods].sort((a,b) => b.v[segIdx]-a.v[segIdx]).filter(p => p.v[segIdx]>0);
  const sortedNews = [...NEWS].sort((a,b) => b.v[segIdx]-a.v[segIdx]);
  return <div style={{display:"flex",gap:12}}>
    <div style={{flex:1,padding:"16px 20px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:podColor,marginBottom:14}}>
        {podLabel}
      </div>
      {sortedPods.length===0 ? <div style={{fontSize:11,color:CP.textDim,fontStyle:"italic"}}>No podcast data for {seg.party==="GOP"?"DEM":"GOP"} segments</div>
        : sortedPods.map((d,i) => <HBar key={i} label={d.l} value={d.v[segIdx]} avg={popAvg(d.v)} color={podColor} maxVal={0.3} />)}
    </div>
    <div style={{flex:1,padding:"16px 20px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.steel,marginBottom:14}}>
        News Sources
      </div>
      {sortedNews.map((d,i) => <HBar key={i} label={d.l} value={d.v[segIdx]} avg={popAvg(d.v)} color={CP.steel} maxVal={0.7} />)}
    </div>
  </div>;
}

// ─── TAB: WELLNESS ───────────────────────────────────────────────────────────
function WellnessPanel({ segIdx }) {
  const headline = WELL_ORIENT[0]; // "US much less healthy"
  const reasons = WELL_ORIENT.slice(1);
  const hVal = headline.v[segIdx];
  const hAvg = popAvg(headline.v);
  const hDelta = hVal - hAvg;
  const hbis = HBIS_SUM[segIdx];
  const hbisAvg = popAvg(HBIS_SUM);

  return <div style={{maxWidth:900}}>
    {/* Row 1: Health Pessimism donut + Why bars */}
    <div style={{display:"flex",gap:12,marginBottom:12}}>
      {/* Headline donut */}
      <div style={{width:220,flexShrink:0,padding:"20px 18px",background:CP.card,borderRadius:10,
        border:`1px solid ${CP.cardBorder}`,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.rose,
          marginBottom:14,textAlign:"center"}}>America's Health</div>
        <ProfDonut value={hVal} avg={hAvg} color={CP.rose} size={110} />
        <div style={{fontSize:11,fontWeight:700,color:CP.rose,marginTop:12,textAlign:"center",lineHeight:1.3}}>
          "America is much less healthy than other countries"
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:8}}>
          <svg width="9" height="9" viewBox="0 0 14 14"
            style={{transform:hDelta>=0?"none":"rotate(180deg)",flexShrink:0}}>
            <path d="M7 1 L13 11 L1 11 Z" fill={hDelta>=0?CP.rose:CP.green} />
          </svg>
          <span style={{fontSize:12,fontWeight:700,color:hDelta>=0?CP.rose:CP.green}}>
            {hDelta>=0?"+":""}{(hDelta*100).toFixed(0)}pp vs avg
          </span>
        </div>
        <div style={{fontSize:8,color:CP.textDim,marginTop:4}}>
          pop avg {(hAvg*100).toFixed(0)}%
        </div>
      </div>
      {/* Reasons bars */}
      <div style={{flex:1,padding:"16px 20px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.rose,marginBottom:14}}>
          Why Is America Sick? · Top Reasons
        </div>
        {reasons.map((d,i) => <HBar key={i} label={d.l} value={d.v[segIdx]} avg={popAvg(d.v)} color={CP.rose} maxVal={0.7} />)}
      </div>
    </div>

    {/* Row 2: HBIS Gauge + Wellness Lifestyles */}
    <div style={{display:"flex",gap:12}}>
      {/* HBIS Gauge */}
      <div style={{width:220,flexShrink:0,padding:"20px 18px",background:CP.card,borderRadius:10,
        border:`1px solid ${CP.cardBorder}`,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.teal,
          marginBottom:14,textAlign:"center"}}>Wellness Behavior Index</div>
        {/* Semi-circle gauge */}
        {(() => {
          const maxScale = 6;
          const r = 52, cx = 60, cy = 58, sw = 10;
          const halfCirc = Math.PI * r;
          const frac = Math.min(1, hbis / maxScale);
          const filled = halfCirc * frac;
          const gap = halfCirc - filled;
          const avgFrac = Math.min(1, hbisAvg / maxScale);
          const avgAng = Math.PI + avgFrac * Math.PI;
          const tx = cx + r * Math.cos(avgAng);
          const ty = cy + r * Math.sin(avgAng);
          return <svg width={120} height={70} viewBox="0 0 120 70" style={{display:"block"}}>
            <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
              fill="none" stroke={CP.dotStrip} strokeWidth={sw} strokeLinecap="round" />
            <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
              fill="none" stroke={CP.teal} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={`${filled} ${gap}`} />
            <circle cx={tx} cy={ty} r={4} fill="none" stroke={CP.steel} strokeWidth={1.5} />
            <text x={cx} y={cy-4} textAnchor="middle" fill={CP.white} fontSize="22" fontWeight="800"
              fontFamily="'DM Sans',sans-serif">{hbis.toFixed(1)}</text>
          </svg>;
        })()}
        <div style={{fontSize:11,fontWeight:600,color:CP.teal,marginTop:6,textAlign:"center",lineHeight:1.3}}>
          Avg activities out of 10
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:8}}>
          {(() => {
            const d = hbis - hbisAvg;
            const dc = d>=0?CP.green:CP.red;
            return <>
              <svg width="9" height="9" viewBox="0 0 14 14"
                style={{transform:d>=0?"none":"rotate(180deg)",flexShrink:0}}>
                <path d="M7 1 L13 11 L1 11 Z" fill={dc} />
              </svg>
              <span style={{fontSize:12,fontWeight:700,color:dc}}>
                {d>=0?"+":""}{d.toFixed(2)} vs avg
              </span>
            </>;
          })()}
        </div>
        <div style={{fontSize:8,color:CP.textDim,marginTop:4}}>
          pop avg {hbisAvg.toFixed(1)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",width:"100%",fontSize:7,color:CP.textDim,
          marginTop:10,paddingTop:6,borderTop:`1px solid ${CP.cardBorder}`}}>
          <span>0 None</span><span>6 High engagement</span>
        </div>
      </div>
      {/* Wellness Lifestyles bars */}
      <div style={{flex:1,padding:"16px 20px",background:CP.card,borderRadius:10,border:`1px solid ${CP.cardBorder}`}}>
        <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:CP.teal,marginBottom:14}}>
          Wellness Lifestyles · "What do you do?"
        </div>
        {WELL_LIFE.map((d,i) => <HBar key={i} label={d.l} value={d.v[segIdx]} avg={popAvg(d.v)} color={CP.teal} maxVal={0.85} />)}
      </div>
    </div>
  </div>;
}

const PROFILE_TABS = [
  { id:"demo", label:"DEMOGRAPHICS" },
  { id:"hiv", label:"HIV" },
  { id:"beliefs", label:"BELIEFS" },
  { id:"ideology", label:"VALUES" },
  { id:"trust", label:"TRUST" },
  { id:"exp", label:"EXPERIENCE" },
  { id:"wellness", label:"CULTURE" },
  { id:"media", label:"MEDIA" },
];

export default function SegmentProfile() {
  const [searchParams] = useSearchParams();
  const initSeg = searchParams.get("seg");
  const initIdx = initSeg ? Math.max(0, SEGMENTS.findIndex(s => s.code === initSeg)) : 0;
  const [segIdx, setSegIdx] = useState(initIdx);
  const [profileTab, setProfileTab] = useState("demo");
  const seg = SEGMENTS[segIdx];
  const tc = seg.party === "GOP" ? "#ef4444" : "#3b82f6";

  return (
    <div style={{ fontFamily:"'Nunito',-apple-system,sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        * { font-variant-numeric: tabular-nums; }
      `}</style>

      <div style={{ maxWidth:1400, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:9, letterSpacing:3, color:"#475569", marginBottom:3 }}>RESERVOIR HEALTH PRISM</div>
          <h1 style={{ fontFamily:"'Roboto',sans-serif", fontSize:22, fontWeight:800, color:"#f1f5f9", margin:0 }}>PERSONA PROFILE</h1>
          <div style={{ fontFamily:"'Roboto',sans-serif", fontSize:13, fontWeight:600, color:"#a78bfa", marginTop:2 }}>PRISM AUDIENCE INTELLIGENCE</div>
        </div>

        {/* Segment selector */}
        <div style={{ display:"flex", gap:3, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:8, color:"#475569", fontFamily:"'Nunito',sans-serif", marginRight:4 }}>SEGMENT:</span>
          {SEGMENTS.map((s,i) => {
            const isSel = segIdx === i;
            // Tier = analyst-configured value from the workbook (study.js).
            // Never read s.tier — that field in the local SEGMENTS array is
            // stale AL-era data and disagrees with the workbook on most rows.
            const st = getAssignedTier(s.code);
            return (
              <button key={s.id} onClick={()=>{setSegIdx(i);setProfileTab("demo")}}
                style={{
                  fontSize:8, padding:"3px 8px", borderRadius:3, cursor:"pointer",
                  border:isSel?`1px solid ${TIER_ACCENT[st]}`:"1px solid #1e293b",
                  background:isSel?(s.party==="GOP"?"#2a1015":"#0f1a2e"):"transparent",
                  color:s.party==="GOP"?"#fca5a5":"#93c5fd",
                  fontFamily:"'Nunito',sans-serif",
                  fontWeight:isSel?700:400, transition:"all 0.15s",
                }}>
                {s.code}
              </button>
            );
          })}
        </div>

        {/* ═══ PROFILE HEADER ═══ */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"#1e293b", border:`3px solid ${tc}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:tc, fontFamily:"'Nunito',sans-serif", letterSpacing:1 }}>{seg.code}</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <h3 style={{ fontFamily:"'Roboto',sans-serif", fontSize:18, color:"#f1f5f9", fontWeight:700, margin:0, textTransform:"uppercase" }}>{seg.name}</h3>
              <span style={{ fontSize:8, padding:"2px 6px", borderRadius:3, background:seg.party==="GOP"?"#7f1d1d":"#1e3a5f", color:seg.party==="GOP"?"#fca5a5":"#93c5fd", fontFamily:"'Nunito',sans-serif", fontWeight:600 }}>{seg.party}</span>
              <span style={{ fontSize:8, padding:"2px 6px", borderRadius:3, background:"#1e293b", color:"#94a3b8", fontFamily:"'Nunito',sans-serif" }}>{seg.pop}% of electorate</span>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div style={{ background:"#111827", borderRadius:6, padding:"10px 14px", borderLeft:`3px solid ${tc}`, marginBottom:14 }}>
          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#e2e8f0", fontStyle:"italic", lineHeight:1.55 }}>"{seg.persona.quote}"</div>
        </div>

        {/* ═══ MAIN LAYOUT: Vector Radar + Persona + ROI ═══ */}
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr 220px", gap:14, marginBottom:20 }}>
          {/* Vector Radar Column */}
          <div style={{ background:"#0a0e1a", borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 10px 10px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#a78bfa", fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>VECTOR FINGERPRINT</div>
            <ProfileVectorRadar seg={seg} />
            <div style={{ width:"100%", marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
              <VectorBars seg={seg} />
            </div>
          </div>

          {/* Persona Narrative */}
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px" }}>
              <SchemaBlock label="What They Believe" text={seg.persona.believe} color="#60a5fa" />
              <SchemaBlock label="What They Want" text={seg.persona.want} color="#34d399" />
              <SchemaBlock label="What They Do" text={seg.persona.doWhat} color="#fbbf24" />
              <SchemaBlock label="Who They Are" text={seg.persona.whoAre} color="#a78bfa" />
            </div>
          </div>

          {/* ROI Card — study-specific (sourced from STUDY_ROI / STUDY_META) */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {STUDY_ROI[seg.code] && (() => {
              const d = STUDY_ROI[seg.code].HIV;
              if (!d) return null;
              const studyTier = getAssignedTier(seg.code);
              const studyTc = TIER_ACCENT[studyTier];
              return (
                <div style={{ background:"#111827", borderRadius:8, padding:"8px 10px", border:"1px solid #1e293b" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <div style={{ fontSize:7, fontWeight:700, color:"#94a3b8", fontFamily:"'Roboto Slab',serif", textTransform:"uppercase", letterSpacing:1.5 }}>{STUDY_META.name} STUDY ROI</div>
                    <span style={{ fontSize:7, fontWeight:700, padding:"1px 6px", borderRadius:3, background:TIER_BG[studyTier], color:TIER_TEXT[studyTier], fontFamily:"'Nunito',sans-serif", letterSpacing:1 }}>{TIER_LABELS[studyTier]}</span>
                  </div>
                  <div style={{ textAlign:"center", padding:"4px 0", borderBottom:"1px solid #1e293b", marginBottom:5 }}>
                    <div style={{ fontSize:24, fontWeight:800, color:studyTc, fontFamily:"'Nunito',sans-serif" }}>{d.roi.toFixed(2)}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <MiniDonut value={d.highRoi} size={30} color={studyTc} />
                      <div><div style={{ fontSize:8, color:"#e2e8f0", fontWeight:600 }}>% High ROI</div></div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <MiniDonut value={d.supporters} size={30} color="#3b82f6" />
                      <div><div style={{ fontSize:8, color:"#e2e8f0", fontWeight:600 }}>% Supporters</div></div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <MiniDonut value={d.activation} size={30} color="#34d399" />
                      <div><div style={{ fontSize:8, color:"#e2e8f0", fontWeight:600 }}>Activation</div></div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, paddingTop:3, borderTop:"1px solid #1e293b" }}>
                      <div style={{ width:30, textAlign:"center" }}><div style={{ fontSize:12, fontWeight:800, color:d.influence>=10?"#fbbf24":"#64748b", fontFamily:"'Nunito',sans-serif" }}>{d.influence}%</div></div>
                      <div><div style={{ fontSize:8, color:"#e2e8f0", fontWeight:600 }}>Influence<sup style={{ fontSize:5 }}>360</sup></div></div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ═══ TABBED SECTION ═══ */}
        <div style={{ display:"flex", gap:2, marginBottom:14, borderBottom:`1px solid ${C.border}`, paddingBottom:0 }}>
          {PROFILE_TABS.map(tab => (
            <button key={tab.id} onClick={()=>setProfileTab(tab.id)} style={{
              padding:"8px 18px", borderRadius:"6px 6px 0 0", border:"none", cursor:"pointer",
              fontSize:11, fontWeight:profileTab===tab.id?500:300, fontFamily:"'Nunito',sans-serif",
              background:profileTab===tab.id?C.card:"transparent",
              color:profileTab===tab.id?"#fff":"#7b8da3",
              borderBottom:profileTab===tab.id?`2px solid ${C.accent}`:"2px solid transparent",
              transition:"all .15s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        {profileTab === "demo" && <DemographicsPanel seg={seg} />}
        {profileTab === "hiv" && (
          <HIVTab
            segmentId={seg.id}
            segmentCode={seg.code}
            segments={SEGMENTS}
            currentIdx={segIdx}
            onChangeSegment={setSegIdx}
            tierAccent={TIER_ACCENT}
          />
        )}
        {profileTab === "beliefs" && <BeliefsPanel segIdx={segIdx} />}
        {profileTab === "ideology" && <IdeologyHeatmap />}
        {profileTab === "trust" && <TrustPanel segIdx={segIdx} />}
        {profileTab === "exp" && <ExpPanel segIdx={segIdx} />}
        {profileTab === "wellness" && <WellnessPanel segIdx={segIdx} />}
        {profileTab === "media" && <MediaPanel segIdx={segIdx} />}

        {/* Footer */}
        <div style={{ marginTop:16, padding:"8px 0", borderTop:"1px solid #1e293b", fontSize:8, color:"#475569", fontFamily:"'Nunito',sans-serif", display:"flex", justifyContent:"space-between" }}>
          <span>PRISM V3.1 · RESERVOIR COMMUNICATIONS GROUP · CONFIDENTIAL & PROPRIETARY</span>
          <span>PRISM AUDIENCE INTELLIGENCE · PRISM PERSONAS</span>
        </div>
      </div>
    </div>
  );
}
