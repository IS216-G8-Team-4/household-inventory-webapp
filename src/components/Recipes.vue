<script setup>
import inventoryData from '@/assets/inventory.json'
</script>

<script>
export default {
    data() {
        return {
            inventory: inventoryData.ingredients,
            recipes: [],
            filteredRecipes: [],
            loading: false,
            error: null,
            
            // Filter options
            filters: {
                cuisine: '',
                maxTime: '',
                dietaryPreference: '',
                searchQuery: ''
            },
            
            // Available filter options
            cuisines: ['American', 'British', 'Canadian', 'Chinese', 'Croatian', 'Dutch', 
                      'Egyptian', 'French', 'Greek', 'Indian', 'Irish', 'Italian', 'Jamaican', 
                      'Japanese', 'Kenyan', 'Malaysian', 'Mexican', 'Moroccan', 'Polish', 
                      'Portuguese', 'Russian', 'Spanish', 'Thai', 'Tunisian', 'Turkish', 'Vietnamese'],
            
            dietaryOptions: ['Vegetarian', 'Vegan', 'Seafood', 'Beef', 'Chicken', 'Pork', 'Lamb'],
            
            // User preferences (can be expanded to load from profile)
            userPreferences: {
                allergies: [],
                dietaryGoals: ''
            },
            
            selectedRecipe: null
        }
    },
    
    computed: {
        // Get all available ingredients from inventory
        availableIngredients() {
            return this.inventory.map(item => item.name.toLowerCase())
        },
        
        // Calculate match percentage for each recipe
        recipesWithMatch() {
            return this.recipes.map(recipe => {
                const recipeIngredients = this.extractRecipeIngredients(recipe)
                const matchedIngredients = recipeIngredients.filter(ing => 
                    this.availableIngredients.some(avail => 
                        avail.includes(ing.toLowerCase()) || ing.toLowerCase().includes(avail)
                    )
                )
                
                const matchPercentage = recipeIngredients.length > 0 
                    ? Math.round((matchedIngredients.length / recipeIngredients.length) * 100)
                    : 0
                
                const missingIngredients = recipeIngredients.filter(ing => 
                    !matchedIngredients.some(matched => matched === ing)
                )
                
                return {
                    ...recipe,
                    matchPercentage,
                    matchedIngredients,
                    missingIngredients,
                    totalIngredients: recipeIngredients.length
                }
            }).sort((a, b) => b.matchPercentage - a.matchPercentage)
        }
    },
    
    methods: {
        // Extract ingredients from recipe object
        extractRecipeIngredients(recipe) {
            const ingredients = []
            for (let i = 1; i <= 20; i++) {
                const ingredient = recipe[`strIngredient${i}`]
                if (ingredient && ingredient.trim()) {
                    ingredients.push(ingredient.trim())
                }
            }
            return ingredients
        },
        
        // Get ingredient measurements
        getIngredientMeasure(recipe, index) {
            return recipe[`strMeasure${index}`] || ''
        },
        
        // Fetch recipes based on available ingredients
        async fetchRecipesByIngredient(ingredient) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`
                )
                const data = await response.json()
                return data.meals || []
            } catch (error) {
                console.error('Error fetching recipes:', error)
                return []
            }
        },
        
        // Fetch full recipe details
        async fetchRecipeDetails(recipeId) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`
                )
                const data = await response.json()
                return data.meals ? data.meals[0] : null
            } catch (error) {
                console.error('Error fetching recipe details:', error)
                return null
            }
        },
        
        // Search recipes by cuisine
        async searchByCuisine(cuisine) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/filter.php?a=${cuisine}`
                )
                const data = await response.json()
                return data.meals || []
            } catch (error) {
                console.error('Error searching by cuisine:', error)
                return []
            }
        },
        
        // Search recipes by category (dietary preference)
        async searchByCategory(category) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/filter.php?c=${category}`
                )
                const data = await response.json()
                return data.meals || []
            } catch (error) {
                console.error('Error searching by category:', error)
                return []
            }
        },
        
        // Main method to load recipes
        async loadRecipes() {
            this.loading = true
            this.error = null
            
            try {
                let recipeIds = new Set()
                
                // If filters are applied, use those
                if (this.filters.cuisine) {
                    const cuisineRecipes = await this.searchByCuisine(this.filters.cuisine)
                    cuisineRecipes.forEach(r => recipeIds.add(r.idMeal))
                } else if (this.filters.dietaryPreference) {
                    const categoryRecipes = await this.searchByCategory(this.filters.dietaryPreference)
                    categoryRecipes.forEach(r => recipeIds.add(r.idMeal))
                } else {
                    // Search by top inventory ingredients
                    const topIngredients = this.inventory.slice(0, 5)
                    
                    for (const item of topIngredients) {
                        const recipes = await this.fetchRecipesByIngredient(item.name)
                        recipes.forEach(r => recipeIds.add(r.idMeal))
                    }
                }
                
                // Fetch full details for each recipe
                const detailedRecipes = []
                const recipeIdArray = Array.from(recipeIds).slice(0, 20) // Limit to 20 recipes
                
                for (const id of recipeIdArray) {
                    const details = await this.fetchRecipeDetails(id)
                    if (details) {
                        detailedRecipes.push(details)
                    }
                }
                
                this.recipes = detailedRecipes
                this.applyFilters()
                
            } catch (error) {
                this.error = 'Failed to load recipes. Please try again.'
                console.error('Error loading recipes:', error)
            } finally {
                this.loading = false
            }
        },
        
        // Apply filters to recipes
        applyFilters() {
            let filtered = this.recipesWithMatch
            
            // Filter by search query
            if (this.filters.searchQuery) {
                const query = this.filters.searchQuery.toLowerCase()
                filtered = filtered.filter(recipe => 
                    recipe.strMeal.toLowerCase().includes(query)
                )
            }
            
            this.filteredRecipes = filtered
        },
        
        // View recipe details
        viewRecipe(recipe) {
            this.selectedRecipe = recipe
        },
        
        // Close recipe modal
        closeRecipeModal() {
            this.selectedRecipe = null
        },
        
        // Get match color class
        getMatchColorClass(percentage) {
            if (percentage >= 80) return 'match-excellent'
            if (percentage >= 60) return 'match-good'
            if (percentage >= 40) return 'match-fair'
            return 'match-low'
        }
    },
    
    mounted() {
        this.loadRecipes()
    }
}
</script>

<template>
    <div class="recipes-container">
        <div class="recipes-header">
            <h1>Recipe Recommendations</h1>
            <p class="subtitle">Recipes matched to your available ingredients</p>
        </div>
        
        <!-- Filters Section -->
        <div class="filters-section">
            <div class="row g-3">
                <div class="col-md-3">
                    <input 
                        v-model="filters.searchQuery"
                        @input="applyFilters"
                        type="text" 
                        class="form-control" 
                        placeholder="Search recipes...">
                </div>
                
                <div class="col-md-3">
                    <select 
                        v-model="filters.cuisine"
                        @change="loadRecipes"
                        class="form-select">
                        <option value="">All Cuisines</option>
                        <option v-for="cuisine in cuisines" :key="cuisine" :value="cuisine">
                            {{ cuisine }}
                        </option>
                    </select>
                </div>
                
                <div class="col-md-3">
                    <select 
                        v-model="filters.dietaryPreference"
                        @change="loadRecipes"
                        class="form-select">
                        <option value="">All Categories</option>
                        <option v-for="diet in dietaryOptions" :key="diet" :value="diet">
                            {{ diet }}
                        </option>
                    </select>
                </div>
                
                <div class="col-md-3">
                    <button 
                        @click="loadRecipes" 
                        class="btn btn-primary w-100"
                        :disabled="loading">
                        <span v-if="loading">Loading...</span>
                        <span v-else>Refresh Recipes</span>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Loading State -->
        <div v-if="loading" class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Finding the best recipes for you...</p>
        </div>
        
        <!-- Error State -->
        <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
        </div>
        
        <!-- Recipes Grid -->
        <div v-if="!loading && filteredRecipes.length > 0" class="recipes-grid">
            <div 
                v-for="recipe in filteredRecipes" 
                :key="recipe.idMeal" 
                class="recipe-card"
                @click="viewRecipe(recipe)">
                
                <div class="recipe-image-container">
                    <img :src="recipe.strMealThumb" :alt="recipe.strMeal" class="recipe-image">
                    <div class="match-badge" :class="getMatchColorClass(recipe.matchPercentage)">
                        {{ recipe.matchPercentage }}% Match
                    </div>
                </div>
                
                <div class="recipe-content">
                    <h3 class="recipe-title">{{ recipe.strMeal }}</h3>
                    
                    <div class="recipe-meta">
                        <span class="badge bg-secondary">{{ recipe.strCategory }}</span>
                        <span class="badge bg-info">{{ recipe.strArea }}</span>
                    </div>
                    
                    <div class="ingredient-summary">
                        <p class="mb-1">
                            <strong>{{ recipe.matchedIngredients.length }}</strong> of 
                            <strong>{{ recipe.totalIngredients }}</strong> ingredients available
                        </p>
                        
                        <div v-if="recipe.missingIngredients.length > 0" class="missing-ingredients">
                            <small class="text-muted">
                                Missing: {{ recipe.missingIngredients.slice(0, 3).join(', ') }}
                                <span v-if="recipe.missingIngredients.length > 3">
                                    +{{ recipe.missingIngredients.length - 3 }} more
                                </span>
                            </small>
                        </div>
                    </div>
                    
                    <button class="btn btn-outline-primary btn-sm w-100 mt-2">
                        View Recipe
                    </button>
                </div>
            </div>
        </div>
        
        <!-- No Results -->
        <div v-if="!loading && filteredRecipes.length === 0" class="text-center my-5">
            <p class="text-muted">No recipes found. Try adjusting your filters.</p>
        </div>
        
        <!-- Recipe Detail Modal -->
        <div v-if="selectedRecipe" class="recipe-modal" @click.self="closeRecipeModal">
            <div class="recipe-modal-content">
                <button class="btn-close-modal" @click="closeRecipeModal">&times;</button>
                
                <div class="row">
                    <div class="col-md-5">
                        <img 
                            :src="selectedRecipe.strMealThumb" 
                            :alt="selectedRecipe.strMeal" 
                            class="recipe-detail-image">
                        
                        <div class="match-detail" :class="getMatchColorClass(selectedRecipe.matchPercentage)">
                            <h4>{{ selectedRecipe.matchPercentage }}% Ingredient Match</h4>
                        </div>
                    </div>
                    
                    <div class="col-md-7">
                        <h2>{{ selectedRecipe.strMeal }}</h2>
                        
                        <div class="recipe-badges mb-3">
                            <span class="badge bg-secondary me-2">{{ selectedRecipe.strCategory }}</span>
                            <span class="badge bg-info">{{ selectedRecipe.strArea }}</span>
                        </div>
                        
                        <h4>Ingredients</h4>
                        <ul class="ingredients-list">
                            <li 
                                v-for="(ingredient, index) in extractRecipeIngredients(selectedRecipe)" 
                                :key="index"
                                :class="{ 
                                    'ingredient-available': selectedRecipe.matchedIngredients.includes(ingredient),
                                    'ingredient-missing': !selectedRecipe.matchedIngredients.includes(ingredient)
                                }">
                                <span class="ingredient-icon">
                                    {{ selectedRecipe.matchedIngredients.includes(ingredient) ? '✓' : '✗' }}
                                </span>
                                {{ getIngredientMeasure(selectedRecipe, index + 1) }} {{ ingredient }}
                            </li>
                        </ul>
                        
                        <h4 class="mt-4">Instructions</h4>
                        <div class="instructions">
                            <p>{{ selectedRecipe.strInstructions }}</p>
                        </div>
                        
                        <div v-if="selectedRecipe.strYoutube" class="mt-3">
                            <a 
                                :href="selectedRecipe.strYoutube" 
                                target="_blank" 
                                class="btn btn-danger">
                                Watch Video Tutorial
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.recipes-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.recipes-header {
    text-align: center;
    margin-bottom: 30px;
}

.subtitle {
    color: #666;
    font-size: 1.1em;
}

.filters-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    margin-bottom: 30px;
}

.recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
    margin-top: 30px;
}

.recipe-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.3s, box-shadow 0.3s;
    cursor: pointer;
}

.recipe-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.recipe-image-container {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
}

.recipe-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.match-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 8px 15px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 0.9em;
    color: white;
}

.match-excellent {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.match-good {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.match-fair {
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.match-low {
    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.recipe-content {
    padding: 20px;
}

.recipe-title {
    font-size: 1.3em;
    margin-bottom: 10px;
    color: #333;
}

.recipe-meta {
    margin-bottom: 15px;
}

.recipe-meta .badge {
    margin-right: 5px;
}

.ingredient-summary {
    padding-top: 10px;
    border-top: 1px solid #eee;
}

.missing-ingredients {
    margin-top: 8px;
}

/* Recipe Modal */
.recipe-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    overflow-y: auto;
}

.recipe-modal-content {
    background: white;
    border-radius: 15px;
    padding: 30px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
}

.btn-close-modal {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    font-size: 2em;
    cursor: pointer;
    color: #666;
    z-index: 10;
}

.btn-close-modal:hover {
    color: #000;
}

.recipe-detail-image {
    width: 100%;
    border-radius: 10px;
    margin-bottom: 20px;
}

.match-detail {
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    color: white;
    margin-bottom: 20px;
}

.recipe-badges {
    margin: 15px 0;
}

.ingredients-list {
    list-style: none;
    padding: 0;
}

.ingredients-list li {
    padding: 8px 12px;
    margin: 5px 0;
    border-radius: 5px;
}

.ingredient-available {
    background: #d4edda;
    color: #155724;
}

.ingredient-missing {
    background: #f8d7da;
    color: #721c24;
}

.ingredient-icon {
    font-weight: bold;
    margin-right: 8px;
}

.instructions {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    white-space: pre-line;
    line-height: 1.6;
}

/* Responsive */
@media (max-width: 768px) {
    .recipes-grid {
        grid-template-columns: 1fr;
    }
    
    .recipe-modal-content {
        padding: 20px;
    }
}
</style>
