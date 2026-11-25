package ro.autocare.tracking;

import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class AndroidUpdateTest {
    private static final String URL = "https://www.autocareapp.ro/downloads/AutoCare-1.7.6.apk";

    @Test public void acceptsOnlyTheOfficialVersionedApk() {
        assertEquals(URL, AndroidUpdate.source(URL,"1.7.6").toString());
        for (String url : new String[] {
            URL.replace("https:", "http:"),
            URL.replace(".ro/", ".ro.example/"),
            URL.replace(".ro/", ".ro:443/"),
            URL.replace("www.", "username@www."),
            URL.replace("downloads/", "downloads/../downloads/"),
            URL + "?source=unknown",
            URL + "#download"
        }) {
            assertThrows(IllegalArgumentException.class, () -> AndroidUpdate.source(url,"1.7.6"));
        }
        assertThrows(IllegalArgumentException.class, () -> AndroidUpdate.source(URL,"1.7.7"));
    }
}
