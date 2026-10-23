type FeatureCategory = {
  id?: unknown;
  subCategory?: unknown;
  [key: string]: unknown;
};

type FeatureItem = {
  id?: unknown;
  isSelected?: unknown;
  [key: string]: unknown;
};

const indexById = <T extends { id?: unknown }>(items: T[], label: string): Map<string, T> => {
  const index = new Map<string, T>();
  items.forEach(item => {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (!id || index.has(id)) {
      throw Object.assign(new Error(`Invalid or duplicate ${label} id`), { status: 400 });
    }
    index.set(id, item);
  });
  return index;
};

export const sanitizeAnalysisFeatureSelection = (
  currentFeatures: FeatureCategory[],
  requestedFeatures: FeatureCategory[]
): FeatureCategory[] => {
  if (!Array.isArray(currentFeatures) || !currentFeatures.length || !Array.isArray(requestedFeatures)) {
    throw Object.assign(new Error('A complete analysis feature selection is required'), { status: 400 });
  }
  if (requestedFeatures.length !== currentFeatures.length) {
    throw Object.assign(new Error('Analysis feature categories cannot be added or removed'), { status: 400 });
  }

  const requestedCategories = indexById(requestedFeatures, 'feature category');
  let selectedCount = 0;
  const sanitized = currentFeatures.map(currentCategory => {
    const categoryId = String(currentCategory.id || '');
    const requestedCategory = requestedCategories.get(categoryId);
    const currentSubCategories = Array.isArray(currentCategory.subCategory)
      ? currentCategory.subCategory as FeatureItem[]
      : [];
    const requestedSubCategories = Array.isArray(requestedCategory?.subCategory)
      ? requestedCategory.subCategory as FeatureItem[]
      : [];
    if (!requestedCategory || requestedSubCategories.length !== currentSubCategories.length) {
      throw Object.assign(new Error('Analysis features cannot be added or removed'), { status: 400 });
    }

    const requestedItems = indexById(requestedSubCategories, 'analysis feature');
    const subCategory = currentSubCategories.map(currentItem => {
      const itemId = String(currentItem.id || '');
      const requestedItem = requestedItems.get(itemId);
      if (!requestedItem || typeof requestedItem.isSelected !== 'boolean') {
        throw Object.assign(new Error('Every analysis feature must include a boolean selection'), { status: 400 });
      }
      if (requestedItem.isSelected) selectedCount += 1;
      return { ...currentItem, isSelected: requestedItem.isSelected };
    });

    return { ...currentCategory, subCategory };
  });

  if (selectedCount === 0) {
    throw Object.assign(new Error('At least one analysis feature must be selected'), { status: 400 });
  }
  return sanitized;
};

export const mergeDefaultFeatureSelections = (
  defaultFeatures: FeatureCategory[],
  existingFeatures: FeatureCategory[]
): FeatureCategory[] => {
  const existingCategories = new Map(
    (Array.isArray(existingFeatures) ? existingFeatures : [])
      .filter(category => typeof category?.id === 'string')
      .map(category => [String(category.id), category])
  );
  return defaultFeatures.map(defaultCategory => {
    const existingCategory = existingCategories.get(String(defaultCategory.id));
    const existingItems = new Map(
      (Array.isArray(existingCategory?.subCategory) ? existingCategory.subCategory as FeatureItem[] : [])
        .filter(item => typeof item?.id === 'string')
        .map(item => [String(item.id), item])
    );
    return {
      ...defaultCategory,
      subCategory: (Array.isArray(defaultCategory.subCategory) ? defaultCategory.subCategory as FeatureItem[] : [])
        .map(defaultItem => ({
          ...defaultItem,
          isSelected: typeof existingItems.get(String(defaultItem.id))?.isSelected === 'boolean'
            ? existingItems.get(String(defaultItem.id))?.isSelected
            : defaultItem.isSelected
        }))
    };
  });
};
