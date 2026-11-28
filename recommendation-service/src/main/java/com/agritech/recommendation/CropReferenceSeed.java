package com.agritech.recommendation;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Seeds the versioned crops reference table from the packaged India crop catalogue on first start. */
@Component
class CropReferenceSeed implements ApplicationRunner {
    private final CropReferenceRepository references;

    CropReferenceSeed(CropReferenceRepository references) { this.references = references; }

    @Override
    public void run(ApplicationArguments args) {
        if (references.count() != 0) return;
        references.saveAll(CropCatalog.all().stream().map(CropReference::from).toList());
    }
}
