# Proposed city and hidden keepsakes pass

Requested by Chris, 2026-10-03. Proposal for review; milestones 40–42 remain the approved next order until the new priority is confirmed.

## What the current build is missing

The active plan generates four ordinary towers, 738 craftsman houses, 693 sheds, 153 apartments, 346 shops and 30 warehouses. Downtown supplies only 21 ordinary buildings. Sixteen authored landmarks add destinations but do not form a dense commercial centre. Existing underground treasure uses one shared glowing shape and twelve names; finds reset each run and there is no persistent collection viewer. The tower and apartment builders currently share the same brick/window facade logic, so even their silhouettes lack a distinct office-city character. The existing interior planner stops its stairs at the highest interior floor; roof destinations need explicit openings and return routes. Inventory evidence: `output/iterate/city-keepsakes-audit.json`.

## Proposed milestone 46 — Explore a recognisable downtown

Create a concentrated city centre within the existing island, transitioning into the residential neighbourhoods. Reserve commercial blocks first so the housing packer cannot consume the skyline. Preserve the sixteen landmarks and their access routes.

- At least six distinct building families: glass office tower, stepped office tower, older brick high-rise, hotel, apartment tower and multi-storey department store/parking building. Vary height, setbacks, podiums, facade rhythm and roof shape, rather than stretching one box. Taller focal towers target 60–100 metres; final density is verified against rendering and destruction budgets.
- Shops and cafe fronts, loading alleys, wider commercial pavements, plazas and roof equipment make the ground level read as a city.
- At least eight traversable upper-floor/roof destinations, each with a documented entrance, continuous stairs and a return route. Breakable windows and walls retain alternate access. Rooftop access must work without developer flight or an owned tool.
- Preserve fine destructible voxels, support collapse and damage persistence. Nearby interior/actor budgets and far silhouettes remain bounded; profile a street walk, upper-floor visit and giant demolition with the original character.
- Automated placement/route/stream/reset/destruction checks; authored Blender sources and native street/skyline/roof captures. Chris judges whether it reads as a city.

Exit: walk from a neighbourhood into downtown, recognise the skyline and commercial streets, enter a tower and reach a roof, then return to the street.

## Proposed milestone 47 — Find Jimothy's prized junk

A finite set of **36 distinct keepsakes** with original recognisable models. They are Jimothy's peculiar possessions and souvenirs. Finding them is the reward: no score, fatness, tool energy, currency, combat bonuses or required unlocks.

Proposed sets (six items each):

| Set | Keepsakes |
| --- | --- |
| Jimothy fan club | Jimothy bobblehead; crooked cardboard halo; homemade rookie card; pawprint stamp; tiny raccoon plush; button saying JIMOTHY WAS HERE |
| Bin royalty | miniature green bin; dented bottle-cap crown; ceremonial plastic spoon; paw-shaped keyring; defeated padlock; polished tin lid |
| Important business | tiny necktie; briefcase of leaves; expired snack-club card; red DO NOT FEED stamp; calculator missing every number but 0; miniature office chair |
| Soft treasures | single tiny mitten; ringed-tail sock; patched handkerchief; doll-sized pants; moth-eaten bow tie; bottle-cap-sized pillow |
| Waterfront finds | barnacled Jimothy medallion; toy tugboat; crab-shaped charm; sea-glass paw; message bottle with a pawprint; miniature diving helmet |
| Rager souvenirs | snapped paparazzi lens; squashed toy taxi; ceremonial traffic cone; broken net buckle; Jimothy snow globe; medal reading I WAS THERE |

- Twelve underwater placements among varied wrecks/ruins and rock pockets, twelve on accessible upper floors/roofs, twelve in alleys, parks and existing landmarks. Some are tucked behind objects or found through a short traversal detour. Every placement has a reachable approach and return route.
- Subtle nearby glints or sound, with normal wall/depth occlusion. No map revealing every hidden object. Undiscovered collection entries can offer broad habitat clues.
- A collection viewer shows the actual model, name, a short gag and set progress. Proposed default: discoveries save locally across runs/reloads; deliberate clearing is separate from restarting a run. Keep the legacy per-run dig finds compatible.
- Deliberate pickup within three-dimensional reach and line of sight; giant size cannot collect through an intact skyscraper. Demolition releases supported keepsakes to shared physics; they survive their surrounding building breaking and do not hover or duplicate. Streaming preserves the moved position for the run.
- Test dry/underwater/upper-floor discovery, occlusion, support loss, save/reload, restart and bounded rendering/physics. Chris judges hiding quality, object recognition and the pleasure of building the collection.

Exit: find a keepsake underwater and another upstairs, inspect both in the collection, restart and reload, and still see them recorded without a gameplay-stat reward.

## Proposed order

46 downtown → 47 hidden keepsakes → 40 larger food/edible attractions → 41 tourists → 42 drivers. Building and route work comes first so collectible locations are authored against the final city, rather than moved again later.

Existing den dressing and the end-of-run photo book stay separate; this collection viewer can later feed those displays without bundling them into this pass.
