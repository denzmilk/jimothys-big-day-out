// The city's design, authored rather than generated (milestone 16).
//
// Regions carry INTENT — a polygon, a grid angle, a block size, a character —
// and the road network is expanded from them by Masterplan.js. Several straight
// grids colliding at different angles is what stops the world reading as a
// lattice, and it is the one irregularity a voxel city can afford: a curved or
// diagonal street staircases every wall along it, several straight grids do
// not. Real Seattle's downtown sits ~32 degrees off the rest of the city; that
// collision is the model.
//
// A .js data module rather than .json so it imports identically in Vite and in
// Node (JSON needs an import attribute), and so the design can carry comments.
// Coordinates are world units, origin at spawn. Edit this to redesign the city.

export default {
  "name": "Imaginary Seattle",
  "note": "The city's design, authored rather than generated (milestone 16). Regions carry INTENT \u2014 a polygon, a grid angle, a spacing, a character \u2014 and the road network is expanded from them. Colliding grids at different angles are what stop it reading as a lattice, and they are the one irregularity a voxel world can afford: a diagonal or curved street means staircased walls, several straight grids do not. Real Seattle's downtown sits about 32 degrees off the rest of the city; that collision is the model. Coordinates are world units, origin at spawn.",
  "bounds": 1000,
  "roadClasses": {
    "arterial": {
      "width": 15,
      "spacingBias": 4
    },
    "street": {
      "width": 9
    },
    "alley": {
      "width": 4
    }
  },
  "regions": [
    {
      "id": "downtown",
      "district": "downtown",
      "note": "The rotated core. 32 degrees off everything else, tight blocks, and alleys behind every commercial row \u2014 the alleys are the point, both for the look and because a raccoon belongs in them.",
      "polygon": [
        [
          -260,
          -300
        ],
        [
          300,
          -260
        ],
        [
          260,
          240
        ],
        [
          -300,
          200
        ]
      ],
      "angle": 32,
      "block": [
        58,
        92
      ],
      "alleys": true,
      "arterialEvery": 4
    },
    {
      "id": "ballard",
      "district": "residential",
      "note": "The big residential quarter, on the true north grid. Wide blocks, no alleys, craftsman houses with yards.",
      "polygon": [
        [
          -1000,
          180
        ],
        [
          -140,
          210
        ],
        [
          -200,
          1000
        ],
        [
          -1000,
          1000
        ]
      ],
      "angle": 0,
      "block": [
        96,
        120
      ],
      "alleys": false,
      "arterialEvery": 5
    },
    {
      "id": "eastside",
      "district": "residential",
      "note": "A second residential grid at a slight skew, so the seam against downtown throws up triangular offcuts rather than a clean edge.",
      "polygon": [
        [
          280,
          -220
        ],
        [
          1000,
          -260
        ],
        [
          1000,
          620
        ],
        [
          240,
          560
        ]
      ],
      "angle": -11,
      "block": [
        88,
        104
      ],
      "alleys": false,
      "arterialEvery": 5
    },
    {
      "id": "interbay",
      "district": "industrial",
      "note": "Port and warehouses along the north-west water. Long blocks, few cross streets \u2014 the biggest volumes in the game, and the best thing to roll through.",
      "polygon": [
        [
          -1000,
          -1000
        ],
        [
          -160,
          -1000
        ],
        [
          -240,
          -330
        ],
        [
          -1000,
          -240
        ]
      ],
      "angle": 8,
      "block": [
        150,
        90
      ],
      "alleys": true,
      "arterialEvery": 3
    },
    {
      "id": "capitol",
      "district": "commercial",
      "note": "High street on a third angle, wedged between downtown and the eastside so both seams are messy.",
      "polygon": [
        [
          300,
          -1000
        ],
        [
          1000,
          -1000
        ],
        [
          1000,
          -300
        ],
        [
          320,
          -250
        ]
      ],
      "angle": 18,
      "block": [
        70,
        88
      ],
      "alleys": true,
      "arterialEvery": 4
    },
    {
      "id": "southlands",
      "district": "residential",
      "note": "Southern residential, angled again so the city never resolves into one direction.",
      "polygon": [
        [
          -180,
          620
        ],
        [
          700,
          660
        ],
        [
          700,
          1000
        ],
        [
          -160,
          1000
        ]
      ],
      "angle": -6,
      "block": [
        92,
        110
      ],
      "alleys": false,
      "arterialEvery": 5
    }
  ],
  "parks": [
    {
      "id": "discovery",
      "note": "The big one. A genuine void in the street network \u2014 you should be able to get lost in it, and it is the clearest possible break from blocks.",
      "polygon": [
        [
          -980,
          -220
        ],
        [
          -560,
          -200
        ],
        [
          -520,
          160
        ],
        [
          -960,
          140
        ]
      ]
    },
    {
      "id": "denny-triangle",
      "note": "The offcut where the downtown and capitol grids collide. Left as a park because the blocks there are unbuildable slivers \u2014 which is exactly why real cities put parks in them.",
      "polygon": [
        [
          280,
          -300
        ],
        [
          420,
          -250
        ],
        [
          300,
          -180
        ]
      ]
    },
    {
      "id": "cal-anderson",
      "polygon": [
        [
          520,
          -520
        ],
        [
          700,
          -500
        ],
        [
          690,
          -360
        ],
        [
          510,
          -380
        ]
      ]
    },
    {
      "id": "green-lake",
      "polygon": [
        [
          -520,
          520
        ],
        [
          -300,
          540
        ],
        [
          -320,
          720
        ],
        [
          -540,
          700
        ]
      ]
    },
    {
      "id": "waterfront-strip",
      "note": "Thin park along the south-west shore; gives the coastline (milestone 14) somewhere to meet the city that isn't a wall of warehouses.",
      "polygon": [
        [
          -1000,
          240
        ],
        [
          -860,
          250
        ],
        [
          -880,
          1000
        ],
        [
          -1000,
          1000
        ]
      ]
    }
  ],
  "plazas": [
    {
      "id": "pike-ish",
      "note": "Market square. Deliberately off-grid and open \u2014 a landmark you navigate by.",
      "center": [
        -60,
        -80
      ],
      "radius": 46
    },
    {
      "id": "civic",
      "center": [
        150,
        90
      ],
      "radius": 34
    }
  ],
  "landmarks": [
    {
      "id": "the-space-noodle",
      "note": "Deliberately off-model parody. The Space Needle's SHAPE is a registered trademark (see docs/backlog.md) \u2014 this is a noodle on a stick and must stay one.",
      "at": [
        -140,
        -420
      ],
      "kind": "tower"
    },
    {
      "id": "jimothys-den",
      "note": "Spawn anchor. The squashed trash can already built by buildTrashCanDen.",
      "at": [
        -10,
        9
      ],
      "kind": "den"
    }
  ],
  "coast": {
    "note": "Placeholder for milestone 14. The island outline lives here so the coastline and the street network are authored against each other rather than discovered to disagree.",
    "polygon": null
  }
};
