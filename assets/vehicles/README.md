# Street vehicles

Original models: **Kenney, Car Kit 3.1**, https://kenney.nl/assets/car-kit .
Licence: **CC0 1.0**. The original licence, six original GLBs and their palette texture are preserved in `kenney-source/`.

Selected models: sedan, hatchback-sports, SUV, van, taxi and delivery truck.

`tools/prepare_vehicles.py` imports these originals through Blender, scales them consistently to metres, separates the authored window faces into transmissive glass, packs textures, saves editable `.blend` files under `assets/blender/vehicles/`, and exports the runtime GLBs to `public/assets/models/vehicles/`.

Rebuild:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/prepare_vehicles.py
```

The runtime retains separate wheels and window/body pieces for terrain alignment and physical breakage. Car geometry is sourced from Kenney; the game's movement, glass and destruction integration are local changes.

`src/core/CarFragments.js` derives cached roof, bonnet/rear, side, bumper and chassis pieces from these imported triangles. Original GLBs and intact meshes stay unchanged; palette UVs and every opaque triangle are retained. Wheels detach separately, glazing uses the glass-shatter system, and sufficiently powerful headbutts emit the local explosion effect. No replacement car models were authored for destruction.

JIM-57: imported hierarchy transforms are flattened before the metre conversion, so the SUV spare inherits the body transform exactly once. `VEHICLES_ONLY=suv` rebuilds only that model while retaining the complete manifest. The spare stays independent for destruction.

## Drivable cabins (M53)

`tools/build_vehicle_cabin.py` creates an original seat and steering-wheel insert in Blender 5.2. The editable source is `assets/blender/vehicles/cabin.blend`; the runtime export is `public/assets/models/vehicles/cabin.glb`. The export combines seats into one vertex-colour mesh and retains one separate steering mesh. Existing Kenney bodies, textures, wheels and glazing remain the source of all six cars.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_vehicle_cabin.py
```

At runtime `VehicleCabin` clips the driver's door out of the imported triangles, retaining vertex attributes and glazing identity. The split exists only during player ownership; exiting disposes its geometry and restores the original car for batching. Cabin geometry/materials are shared by at most nine occupied cars. MPFB drivers and Jimothy keep their original skeletons and dimensions.
