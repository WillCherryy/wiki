# External reference data

- `newman1.prec`, `newman1.upit`: MineLib instance Newman1 (Espinoza, Goycoolea, Moreno and Newman 2013), as distributed in AMPL's MineLib notebook (github.com/ampl/colab.ampl.com, authors/eduardosalaz/minelib/data/newman1). Used by `earthbench/external/minelib.py`.
- `pvgis/`: hourly series for 2019 from PVGIS 5.2 (European Commission Joint Research Centre, re.jrc.ec.europa.eu/api/v5_2/seriescalc), SARAH-2 irradiance and ERA5 meteorology, no horizon: `h0_*` a horizontal plane (beam and diffuse), `pv30_*` a 30 degree south plane with a 1 kWp crystalline-silicon system and 14% loss. Used by `earthbench/external/pvgis.py`.
- `pvgis/h0_<site>_<year>.json.gz`: the same request (horizontal plane, no horizon, SARAH-2 and ERA5) for eight sites and years, downloaded 6 November 2026: Madrid, Freiburg, Seville and Berlin for 2020; Lisbon, Nairobi, Athens and Cairo for 2019. The real-weather pack `earthbench/pvreal.py` serves them unchanged.
- The PEER benchmark answers are typed into `earthbench/external/peer.py` from PEER Report 2010/106 (Table 3.2 and Appendix A); the report itself is not copied here.
