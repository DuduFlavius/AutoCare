package ro.autocare.tracking;

/** Exact, non-empty Bluetooth identity and account match. Never match device names. */
final class CarIdentity {
    static boolean valid(String address) {
        return address != null && address.matches("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}")
            && !address.equals("00:00:00:00:00:00") && !address.equals("02:00:00:00:00:00");
    }
    static boolean matches(String expected, String actual, String owner, String activeOwner, String vehicle) {
        return valid(expected) && valid(actual) && expected.equalsIgnoreCase(actual)
            && owner != null && !owner.isEmpty() && owner.equals(activeOwner)
            && vehicle != null && !vehicle.isEmpty();
    }
}
