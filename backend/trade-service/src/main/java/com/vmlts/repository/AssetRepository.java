package com.vmlts.repository;

import com.vmlts.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AssetRepository extends JpaRepository<Asset, Long> {
    Optional<Asset> findBySymbol(String symbol);
    List<Asset> findByActiveTrue();
}
