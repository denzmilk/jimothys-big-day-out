// Imaginary Seattle — the island's structure, authored (milestone 17).
//
// Coastline, water, bridges, hills and district polygons. This is DATA: edit it
// to redesign the city. It carries no street network yet — the structure lands
// first, then streets get drawn against a coastline that already exists, which
// is the mistake milestone 16 made in the other order.
//
// Every name keeps the SHAPE of its Seattle original so the map reads as a
// gazetteer rather than a list of jokes; `realName` records the riff.
//
// Coordinates are world units, origin at spawn, +z south.

export default {
  "bounds": 1000,
  "note": "Imaginary Seattle as an island. Real Seattle is an isthmus between Puget Sound and Lake Washington, cut east-west by the Ship Canal and interrupted by Lake Union -- closing that into an island keeps everything that makes the place legible (a deep bay at downtown, two peninsulas, an interior lake, a canal that halves the city) while being nobody's actual city. Names keep the SHAPE of the Seattle originals so the map still reads as a gazetteer rather than a list of jokes; realName records what each one is riffing on.",
  "coast": [
    [
      0,
      -905
    ],
    [
      210,
      -870
    ],
    [
      400,
      -815
    ],
    [
      520,
      -700
    ],
    [
      605,
      -585
    ],
    [
      665,
      -430
    ],
    [
      690,
      -300
    ],
    [
      700,
      -140
    ],
    [
      672,
      10
    ],
    [
      640,
      170
    ],
    [
      590,
      330
    ],
    [
      512,
      510
    ],
    [
      400,
      660
    ],
    [
      268,
      790
    ],
    [
      150,
      838
    ],
    [
      70,
      800
    ],
    [
      30,
      690
    ],
    [
      18,
      560
    ],
    [
      -40,
      530
    ],
    [
      -92,
      600
    ],
    [
      -140,
      668
    ],
    [
      -250,
      742
    ],
    [
      -360,
      730
    ],
    [
      -432,
      628
    ],
    [
      -408,
      512
    ],
    [
      -322,
      452
    ],
    [
      -212,
      470
    ],
    [
      -138,
      432
    ],
    [
      -104,
      352
    ],
    [
      -120,
      262
    ],
    [
      -208,
      232
    ],
    [
      -300,
      196
    ],
    [
      -368,
      120
    ],
    [
      -392,
      26
    ],
    [
      -352,
      -60
    ],
    [
      -286,
      -118
    ],
    [
      -282,
      -198
    ],
    [
      -372,
      -232
    ],
    [
      -470,
      -212
    ],
    [
      -560,
      -262
    ],
    [
      -668,
      -286
    ],
    [
      -722,
      -206
    ],
    [
      -690,
      -96
    ],
    [
      -596,
      -52
    ],
    [
      -486,
      -72
    ],
    [
      -408,
      -128
    ],
    [
      -392,
      -238
    ],
    [
      -420,
      -352
    ],
    [
      -448,
      -470
    ],
    [
      -402,
      -596
    ],
    [
      -306,
      -690
    ],
    [
      -188,
      -782
    ],
    [
      -92,
      -862
    ]
  ],
  "water": [
    {
      "id": "lake-onion",
      "kind": "lake",
      "note": "The interior lake. Seattle's single most orienting feature and a natural landmark to navigate by.",
      "polygon": [
        [
          -150,
          -390
        ],
        [
          -40,
          -425
        ],
        [
          80,
          -400
        ],
        [
          128,
          -330
        ],
        [
          120,
          -238
        ],
        [
          60,
          -186
        ],
        [
          -52,
          -176
        ],
        [
          -136,
          -220
        ],
        [
          -166,
          -306
        ]
      ],
      "realName": "lake-union"
    },
    {
      "id": "grease-lake",
      "kind": "lake",
      "note": "Small round lake in the north. Reads instantly as a park district.",
      "polygon": [
        [
          30,
          -712
        ],
        [
          102,
          -700
        ],
        [
          142,
          -648
        ],
        [
          130,
          -582
        ],
        [
          70,
          -548
        ],
        [
          6,
          -566
        ],
        [
          -24,
          -624
        ],
        [
          -8,
          -684
        ]
      ],
      "realName": "green-lake"
    },
    {
      "id": "chip-canal-west",
      "kind": "canal",
      "note": "West arm: sea to Lake Union. With the east arm it cuts the island in two, so every north-south trip crosses a bridge - chokepoints the pursuit can use.",
      "polygon": [
        [
          -412,
          -330
        ],
        [
          -166,
          -306
        ],
        [
          -150,
          -390
        ],
        [
          -420,
          -408
        ]
      ],
      "realName": "ship-canal-w"
    },
    {
      "id": "chip-canal-east",
      "kind": "canal",
      "note": "East arm: Lake Union to the east shore.",
      "polygon": [
        [
          128,
          -330
        ],
        [
          684,
          -300
        ],
        [
          688,
          -232
        ],
        [
          120,
          -238
        ]
      ],
      "realName": "ship-canal-e"
    },
    {
      "id": "chewamish",
      "kind": "river",
      "note": "Industrial waterway splitting the south. Gives the port a reason to exist and separates the West Seattle peninsula.",
      "polygon": [
        [
          18,
          560
        ],
        [
          30,
          690
        ],
        [
          -40,
          700
        ],
        [
          -92,
          600
        ],
        [
          -40,
          530
        ]
      ],
      "realName": "duwamish"
    }
  ],
  "bridges": [
    {
      "id": "freemunch",
      "at": [
        -40,
        -355
      ],
      "span": 70,
      "note": "North-south crossing at the west arm",
      "realName": "fremont"
    },
    {
      "id": "aroma",
      "at": [
        60,
        -360
      ],
      "span": 60,
      "realName": "aurora"
    },
    {
      "id": "chew",
      "at": [
        300,
        -284
      ],
      "span": 60,
      "realName": "university"
    },
    {
      "id": "munchlake",
      "at": [
        520,
        -272
      ],
      "span": 60,
      "realName": "montlake"
    },
    {
      "id": "squattle",
      "at": [
        -30,
        612
      ],
      "span": 80,
      "note": "The only road onto the peninsula",
      "realName": "west-seattle"
    }
  ],
  "hills": [
    {
      "id": "trash-panda-heights",
      "at": [
        -250,
        -190
      ],
      "radius": 175,
      "height": 62,
      "note": "The steep one. Seattle's landmark climb.",
      "realName": "queen-anne"
    },
    {
      "id": "compost-hill",
      "at": [
        40,
        -40
      ],
      "radius": 210,
      "height": 48,
      "realName": "capitol-hill"
    },
    {
      "id": "mangy-point",
      "at": [
        -545,
        -165
      ],
      "radius": 165,
      "height": 44,
      "realName": "magnolia"
    },
    {
      "id": "bacon-hill",
      "at": [
        270,
        300
      ],
      "radius": 215,
      "height": 40,
      "realName": "beacon-hill"
    },
    {
      "id": "west-squattle",
      "at": [
        -255,
        585
      ],
      "radius": 190,
      "height": 46,
      "realName": "west-seattle"
    },
    {
      "id": "binney-ridge",
      "at": [
        -130,
        -560
      ],
      "radius": 190,
      "height": 34,
      "realName": "phinney"
    },
    {
      "id": "thirst-hill",
      "at": [
        -90,
        60
      ],
      "radius": 110,
      "height": 30,
      "realName": "first-hill"
    },
    {
      "id": "nibble-ridge",
      "at": [
        280,
        -700
      ],
      "radius": 240,
      "height": 26,
      "realName": "north-ridge"
    }
  ],
  "districts": [
    {
      "id": "trashattan",
      "character": "core",
      "angle": 32,
      "at": [
        -250,
        45
      ],
      "polygon": [
        [
          -368,
          120
        ],
        [
          -392,
          26
        ],
        [
          -352,
          -60
        ],
        [
          -286,
          -118
        ],
        [
          -150,
          -90
        ],
        [
          -110,
          60
        ],
        [
          -190,
          175
        ],
        [
          -300,
          196
        ]
      ],
      "note": "Downtown. Dense core on the bay -- Manhattan by way of a bin.",
      "realName": "downtown"
    },
    {
      "id": "sotrash",
      "character": "industrial",
      "angle": 32,
      "at": [
        -120,
        330
      ],
      "polygon": [
        [
          -190,
          175
        ],
        [
          -110,
          60
        ],
        [
          10,
          120
        ],
        [
          40,
          330
        ],
        [
          18,
          560
        ],
        [
          -104,
          352
        ],
        [
          -120,
          262
        ],
        [
          -208,
          232
        ]
      ],
      "note": "South of Trashattan, exactly as the real SoDo is South of Downtown. Port and warehouses.",
      "realName": "sodo"
    },
    {
      "id": "compost-hill",
      "character": "dense-residential",
      "angle": 0,
      "at": [
        80,
        -60
      ],
      "polygon": [
        [
          -110,
          60
        ],
        [
          -150,
          -90
        ],
        [
          -52,
          -176
        ],
        [
          120,
          -238
        ],
        [
          240,
          -190
        ],
        [
          250,
          -30
        ],
        [
          120,
          80
        ],
        [
          10,
          120
        ]
      ],
      "note": "Dense housing and a high street, on a hill, quietly rotting.",
      "realName": "capitol-hill"
    },
    {
      "id": "trash-panda-heights",
      "character": "residential",
      "angle": 12,
      "at": [
        -250,
        -190
      ],
      "polygon": [
        [
          -286,
          -118
        ],
        [
          -282,
          -198
        ],
        [
          -372,
          -232
        ],
        [
          -408,
          -330
        ],
        [
          -166,
          -306
        ],
        [
          -52,
          -176
        ],
        [
          -150,
          -90
        ]
      ],
      "note": "The steep one. Named for the only raccoon meme that matters.",
      "realName": "queen-anne"
    },
    {
      "id": "mangy-point",
      "character": "suburb",
      "angle": -8,
      "at": [
        -545,
        -165
      ],
      "polygon": [
        [
          -372,
          -232
        ],
        [
          -470,
          -212
        ],
        [
          -560,
          -262
        ],
        [
          -668,
          -286
        ],
        [
          -722,
          -206
        ],
        [
          -690,
          -96
        ],
        [
          -596,
          -52
        ],
        [
          -486,
          -72
        ],
        [
          -408,
          -128
        ],
        [
          -392,
          -238
        ]
      ],
      "note": "Low-density peninsula suburb with the big park. Quiet and mangy.",
      "realName": "magnolia"
    },
    {
      "id": "bandit-bay",
      "character": "mixed",
      "angle": 0,
      "at": [
        -300,
        -520
      ],
      "polygon": [
        [
          -420,
          -408
        ],
        [
          -448,
          -470
        ],
        [
          -402,
          -596
        ],
        [
          -306,
          -690
        ],
        [
          -188,
          -782
        ],
        [
          -120,
          -700
        ],
        [
          -150,
          -500
        ],
        [
          -150,
          -390
        ]
      ],
      "note": "Coastal main street. Bandit for the mask.",
      "realName": "ballard"
    },
    {
      "id": "freemunch",
      "character": "residential",
      "angle": 0,
      "at": [
        30,
        -470
      ],
      "polygon": [
        [
          -150,
          -390
        ],
        [
          -150,
          -500
        ],
        [
          -120,
          -700
        ],
        [
          6,
          -566
        ],
        [
          -24,
          -624
        ],
        [
          30,
          -712
        ],
        [
          142,
          -648
        ],
        [
          190,
          -500
        ],
        [
          128,
          -330
        ],
        [
          -40,
          -425
        ]
      ],
      "note": "Residential grid around the lake. Free munch.",
      "realName": "fremont"
    },
    {
      "id": "chew-district",
      "character": "mixed",
      "angle": -6,
      "at": [
        340,
        -430
      ],
      "polygon": [
        [
          190,
          -500
        ],
        [
          280,
          -600
        ],
        [
          440,
          -620
        ],
        [
          560,
          -540
        ],
        [
          605,
          -430
        ],
        [
          665,
          -430
        ],
        [
          690,
          -300
        ],
        [
          128,
          -330
        ]
      ],
      "note": "Students and a commercial strip. Chewing, mostly.",
      "realName": "u-district"
    },
    {
      "id": "northgorge",
      "character": "retail",
      "angle": 0,
      "at": [
        180,
        -760
      ],
      "polygon": [
        [
          -188,
          -782
        ],
        [
          -92,
          -862
        ],
        [
          0,
          -905
        ],
        [
          210,
          -870
        ],
        [
          400,
          -815
        ],
        [
          440,
          -620
        ],
        [
          280,
          -600
        ],
        [
          190,
          -500
        ],
        [
          142,
          -648
        ],
        [
          102,
          -700
        ],
        [
          30,
          -712
        ],
        [
          -24,
          -624
        ],
        [
          -120,
          -700
        ]
      ],
      "note": "Strip malls and big-box retail. Gorging encouraged.",
      "realName": "northgate"
    },
    {
      "id": "rummage-valley",
      "character": "suburb",
      "angle": -4,
      "at": [
        340,
        320
      ],
      "polygon": [
        [
          250,
          -30
        ],
        [
          672,
          10
        ],
        [
          640,
          170
        ],
        [
          590,
          330
        ],
        [
          512,
          510
        ],
        [
          400,
          660
        ],
        [
          268,
          790
        ],
        [
          150,
          838
        ],
        [
          70,
          800
        ],
        [
          40,
          330
        ],
        [
          120,
          80
        ]
      ],
      "note": "Southern suburbs on strip-mall arterials. Prime rummaging.",
      "realName": "rainier"
    },
    {
      "id": "west-squattle",
      "character": "suburb",
      "angle": 14,
      "at": [
        -255,
        585
      ],
      "polygon": [
        [
          -40,
          530
        ],
        [
          -92,
          600
        ],
        [
          -140,
          668
        ],
        [
          -250,
          742
        ],
        [
          -360,
          730
        ],
        [
          -432,
          628
        ],
        [
          -408,
          512
        ],
        [
          -322,
          452
        ],
        [
          -212,
          470
        ],
        [
          -138,
          432
        ],
        [
          -104,
          352
        ],
        [
          -120,
          262
        ],
        [
          18,
          560
        ]
      ],
      "note": "Suburban peninsula, one bridge in. Squatting rights.",
      "realName": "west-seattle"
    },
    {
      "id": "eastlick",
      "character": "mixed",
      "angle": 8,
      "at": [
        300,
        -140
      ],
      "polygon": [
        [
          240,
          -190
        ],
        [
          690,
          -300
        ],
        [
          688,
          -232
        ],
        [
          672,
          10
        ],
        [
          250,
          -30
        ]
      ],
      "note": "East shore strip between the hill and the lake.",
      "realName": "eastlake"
    }
  ]
};
