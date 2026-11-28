package com.agritech.crop;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One farm's report for one day. Kept for history; today's row is refreshed as the day goes on
 * and frozen by the nightly job. The full report is stored as JSON (it is only ever read whole),
 * with the fields worth querying on as columns.
 */
@Entity
@Table(name = "daily_reports",
        uniqueConstraints = @UniqueConstraint(name = "uk_report_owner_date", columnNames = {"ownerEmail", "reportDate"}),
        indexes = @Index(name = "idx_report_owner_date", columnList = "ownerEmail,reportDate"))
public class DailyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String ownerEmail;

    @Column(nullable = false)
    private LocalDate reportDate;

    @Column(nullable = false)
    private Instant generatedAt;

    /** OPTIMAL, ACCEPTABLE, NEEDS_ATTENTION, CRITICAL or NO_DATA. */
    @Column(name = "overall_condition", nullable = false, length = 20)
    private String condition;

    /** False while the day is still running. */
    private boolean complete;

    @Column(nullable = false, length = 20000)
    private String payload;

    protected DailyReport() {}

    DailyReport(String ownerEmail, LocalDate reportDate) {
        this.ownerEmail = ownerEmail;
        this.reportDate = reportDate;
    }

    void refresh(String condition, boolean complete, String payload) {
        this.condition = condition;
        this.complete = complete;
        this.payload = payload;
        this.generatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getOwnerEmail() { return ownerEmail; }
    public LocalDate getReportDate() { return reportDate; }
    public Instant getGeneratedAt() { return generatedAt; }
    public String getCondition() { return condition; }
    public boolean isComplete() { return complete; }
    public String getPayload() { return payload; }
}
