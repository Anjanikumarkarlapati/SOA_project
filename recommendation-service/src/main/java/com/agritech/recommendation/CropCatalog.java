package com.agritech.recommendation;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Agronomic ranges for the 48 crops the farm setup offers (ids match frontend/src/farm/india.ts).
 * Each crop group has sensible defaults; a crop overrides only what genuinely differs, so the
 * table stays readable. Temperatures are each crop's own growing range.
 *
 * ponytail: indicative ranges for Indian field conditions, good enough to grade simulated data
 * and drive advice. Swap in ICAR / state agriculture department tables before real agronomy use.
 */
public final class CropCatalog {

    /** Optimal band for one metric. */
    public record Range(double min, double max) {
        public double mid() { return (min + max) / 2; }
        public double width() { return Math.max(max - min, 0.001); }
    }

    /**
     * Everything the reports and the simulator need to know about a crop.
     *
     * @param light      midday light intensity, lux
     * @param n          soil nitrogen / phosphorus / potassium, mg/kg
     * @param waterLevel standing water for ponded crops, mm (null otherwise)
     */
    public record Spec(String id, String name, String group, Range temperature, Range moisture,
                       Range humidity, Range ph, Range light, Range n, Range p, Range k,
                       Range waterLevel, boolean ponded, boolean fungal) {}

    private record Group(Range moisture, Range humidity, Range ph, Range light, Range n, Range p, Range k) {}

    private static Range r(double min, double max) { return new Range(min, max); }

    private static final Map<String, Group> GROUPS = Map.of(
            "Cereals", new Group(r(50, 70), r(50, 75), r(6.0, 7.5), r(40000, 80000), r(250, 400), r(20, 40), r(150, 300)),
            "Millets", new Group(r(35, 55), r(40, 65), r(5.5, 7.5), r(45000, 90000), r(150, 300), r(15, 30), r(120, 250)),
            "Pulses", new Group(r(40, 60), r(45, 70), r(6.0, 7.5), r(40000, 80000), r(120, 250), r(25, 45), r(150, 250)),
            "Oilseeds", new Group(r(40, 60), r(45, 70), r(6.0, 7.5), r(45000, 85000), r(200, 350), r(20, 40), r(150, 280)),
            "Cash crops", new Group(r(50, 70), r(55, 80), r(6.0, 7.5), r(45000, 90000), r(250, 450), r(20, 40), r(200, 350)),
            "Vegetables", new Group(r(60, 80), r(55, 80), r(6.0, 7.0), r(30000, 70000), r(250, 400), r(30, 50), r(200, 350)),
            "Fruits", new Group(r(50, 70), r(50, 80), r(5.5, 7.5), r(40000, 85000), r(200, 350), r(20, 40), r(200, 350)),
            "Spices", new Group(r(55, 75), r(55, 80), r(6.0, 7.5), r(25000, 60000), r(200, 350), r(25, 45), r(200, 300)),
            "Plantation", new Group(r(60, 80), r(70, 90), r(5.0, 6.5), r(25000, 60000), r(250, 400), r(20, 40), r(200, 350)));

    /** Optional per-crop overrides on top of the group defaults. */
    private record Override(Range moisture, Range humidity, Range ph, Range light) {}

    private static final Map<String, Override> OVERRIDES = Map.ofEntries(
            Map.entry("rice", new Override(r(75, 95), r(65, 85), r(5.5, 7.0), null)),
            Map.entry("bajra", new Override(null, r(35, 60), null, null)),
            Map.entry("sugarcane", new Override(r(60, 80), null, null, null)),
            Map.entry("cotton", new Override(r(45, 65), null, null, null)),
            Map.entry("groundnut", new Override(null, null, r(6.0, 7.0), null)),
            Map.entry("potato", new Override(null, null, r(5.0, 6.5), null)),
            Map.entry("banana", new Override(r(65, 85), r(60, 85), null, null)),
            Map.entry("grapes", new Override(null, r(50, 70), null, null)),
            Map.entry("pomegranate", new Override(r(35, 55), r(35, 60), null, null)),
            Map.entry("cumin", new Override(r(35, 55), r(35, 60), null, null)),
            Map.entry("tea", new Override(null, null, r(4.5, 5.5), null)),
            Map.entry("coffee", new Override(null, null, r(5.0, 6.0), r(20000, 45000))),
            Map.entry("pepper", new Override(null, r(70, 90), null, null)));

    private static final Map<String, Spec> CROPS = new LinkedHashMap<>();

    private static void crop(String id, String name, String group, double tMin, double tMax, String... flags) {
        Group g = GROUPS.get(group);
        Override o = OVERRIDES.get(id);
        boolean ponded = Arrays.asList(flags).contains("ponded");
        CROPS.put(id, new Spec(id, name, group, r(tMin, tMax),
                o != null && o.moisture() != null ? o.moisture() : g.moisture(),
                o != null && o.humidity() != null ? o.humidity() : g.humidity(),
                o != null && o.ph() != null ? o.ph() : g.ph(),
                o != null && o.light() != null ? o.light() : g.light(),
                g.n(), g.p(), g.k(),
                ponded ? r(20, 50) : null,
                ponded, Arrays.asList(flags).contains("fungal")));
    }

    static {
        crop("rice", "Rice (Paddy)", "Cereals", 20, 35, "ponded", "fungal");
        crop("wheat", "Wheat", "Cereals", 12, 25);
        crop("maize", "Maize (Corn)", "Cereals", 18, 32);
        crop("barley", "Barley", "Cereals", 12, 25);
        crop("jowar", "Jowar (Sorghum)", "Millets", 25, 35);
        crop("bajra", "Bajra (Pearl millet)", "Millets", 25, 38);
        crop("ragi", "Ragi (Finger millet)", "Millets", 20, 32);
        crop("chana", "Chickpea (Chana)", "Pulses", 15, 28);
        crop("tur", "Pigeon pea (Arhar / Tur)", "Pulses", 20, 35);
        crop("moong", "Green gram (Moong)", "Pulses", 25, 35);
        crop("urad", "Black gram (Urad)", "Pulses", 25, 35);
        crop("masoor", "Lentil (Masoor)", "Pulses", 15, 27);
        crop("groundnut", "Groundnut (Peanut)", "Oilseeds", 22, 33);
        crop("mustard", "Mustard (Sarson)", "Oilseeds", 10, 25);
        crop("soybean", "Soybean", "Oilseeds", 20, 32);
        crop("sunflower", "Sunflower", "Oilseeds", 20, 30);
        crop("sesame", "Sesame (Til)", "Oilseeds", 25, 35);
        crop("castor", "Castor", "Oilseeds", 20, 33);
        crop("cotton", "Cotton", "Cash crops", 21, 35);
        crop("sugarcane", "Sugarcane", "Cash crops", 20, 35);
        crop("jute", "Jute", "Cash crops", 24, 37);
        crop("tobacco", "Tobacco", "Cash crops", 20, 30);
        crop("potato", "Potato", "Vegetables", 15, 24, "fungal");
        crop("onion", "Onion", "Vegetables", 13, 28, "fungal");
        crop("tomato", "Tomato", "Vegetables", 18, 30, "fungal");
        crop("brinjal", "Brinjal (Baingan)", "Vegetables", 20, 32);
        crop("chilli", "Chilli (Mirchi)", "Vegetables", 20, 32, "fungal");
        crop("okra", "Okra (Bhindi)", "Vegetables", 22, 35);
        crop("cabbage", "Cabbage (Patta gobhi)", "Vegetables", 12, 24);
        crop("cauliflower", "Cauliflower (Phool gobhi)", "Vegetables", 12, 25);
        crop("cucumber", "Cucumber (Kheera)", "Vegetables", 20, 32, "fungal");
        crop("peas", "Green peas (Matar)", "Vegetables", 10, 24);
        crop("banana", "Banana", "Fruits", 20, 35, "fungal");
        crop("mango", "Mango", "Fruits", 24, 35);
        crop("grapes", "Grapes", "Fruits", 15, 35, "fungal");
        crop("pomegranate", "Pomegranate (Anar)", "Fruits", 25, 38);
        crop("citrus", "Citrus (Orange / Kinnow)", "Fruits", 15, 33);
        crop("papaya", "Papaya", "Fruits", 22, 35, "fungal");
        crop("guava", "Guava (Amrood)", "Fruits", 20, 35);
        crop("turmeric", "Turmeric (Haldi)", "Spices", 20, 32);
        crop("ginger", "Ginger (Adrak)", "Spices", 20, 30, "fungal");
        crop("garlic", "Garlic (Lahsun)", "Spices", 12, 25);
        crop("cumin", "Cumin (Jeera)", "Spices", 12, 28, "fungal");
        crop("coriander", "Coriander (Dhaniya)", "Spices", 15, 28);
        crop("coconut", "Coconut", "Plantation", 22, 34);
        crop("tea", "Tea", "Plantation", 18, 30, "fungal");
        crop("coffee", "Coffee", "Plantation", 15, 28, "fungal");
        crop("pepper", "Black pepper", "Plantation", 20, 32, "fungal");
    }

    private CropCatalog() {}

    /** Lookup by id ("rice") or by name ("Rice (Paddy)", "rice (paddy)"), case-insensitive. */
    public static Optional<Spec> find(String idOrName) {
        if (idOrName == null) return Optional.empty();
        String key = idOrName.trim().toLowerCase(Locale.ROOT);
        Spec byId = CROPS.get(key);
        if (byId != null) return Optional.of(byId);
        return CROPS.values().stream()
                .filter(s -> s.name().toLowerCase(Locale.ROOT).equals(key)
                        || s.name().toLowerCase(Locale.ROOT).startsWith(key + " ("))
                .findFirst();
    }

    /** Generic mid-range envelope for a free-text crop the catalog does not know. */
    public static Spec generic(String name) {
        Group g = GROUPS.get("Cereals");
        return new Spec("custom", name, "Other", r(18, 30), r(50, 70), g.humidity(), r(6.0, 7.0),
                g.light(), g.n(), g.p(), g.k(), null, false, false);
    }

    public static int size() { return CROPS.size(); }

    public static java.util.List<Spec> all() { return java.util.List.copyOf(CROPS.values()); }
}
