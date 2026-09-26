package com.agritech.sensor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** A field the irrigation service is currently watering, so simulated moisture responds to valves. */
@Entity
@Table(name = "field_watering")
public class FieldWatering {

    @Id
    private String fieldId;

    @Column(name = "watering_until")
    private Instant until;

    protected FieldWatering() {}

    public FieldWatering(String fieldId, Instant until) {
        this.fieldId = fieldId;
        this.until = until;
    }

    public String getFieldId() { return fieldId; }
    public Instant getUntil() { return until; }
}
