package com.college.library.identity;

import com.college.library.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "user_identifiers",
    uniqueConstraints = @UniqueConstraint(columnNames = {"type", "identifier_value"})
)
public class UserIdentifier extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IdentifierType type;

    @Column(name = "identifier_value", nullable = false)
    private String value;

    @Column(nullable = false)
    private boolean verified;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    protected UserIdentifier() {
    }

    public UserIdentifier(IdentifierType type, String value, boolean verified) {
        this.type = type;
        this.value = value;
        this.verified = verified;
    }

    public IdentifierType getType() {
        return type;
    }

    public String getValue() {
        return value;
    }

    public boolean isVerified() {
        return verified;
    }

    public UserAccount getUser() {
        return user;
    }

    void assignTo(UserAccount user) {
        this.user = user;
    }
}
