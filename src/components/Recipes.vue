<script>
import { supabase } from '@/lib/supabase.js'
import RecipeLoadingSkeleton from './RecipeLoadingSkeleton.vue';

export default {
    data() {
        return {
            session: null,
            householdId: null,
            inventory: [],
            expiringIngredients: [],
            recipes: [],
            filteredRecipes: [],
            loading: false,
            error: null,
            
            filters: {
                cuisine: '',
                maxTime: '',
                dietaryPreference: '',
                searchQuery: '',
                useExpiringOnly: false
            },
            
            cuisines: ['American', 'British', 'Canadian', 'Chinese', 'Croatian', 'Dutch', 
                      'Egyptian', 'French', 'Greek', 'Indian', 'Irish', 'Italian', 'Jamaican', 
                      'Japanese', 'Kenyan', 'Malaysian', 'Mexican', 'Moroccan', 'Polish', 
                      'Portuguese', 'Russian', 'Spanish', 'Thai', 'Tunisian', 'Turkish', 'Vietnamese'],
            
            dietaryOptions: ['Vegetarian', 'Vegan', 'Seafood', 'Beef', 'Chicken', 'Pork', 'Lamb'],
            
            selectedRecipe: null,
            
            showUseRecipeConfirmation: false,
            recipeToUse: null,
            ingredientsToDeduct: [],
            usingRecipe: false,
            
            showUndoNotification: false,
            undoTimer: null,
            lastDeduction: null
        }
    },

    components:{
        RecipeLoadingSkeleton
    },
    
    computed: {
        availableIngredients() {
            return this.inventory.map(item => item.name.toLowerCase())
        },
        
        expiringIngredientNames() {
            return this.expiringIngredients.map(item => item.name.toLowerCase())
        },
        
        recipesWithMatch() {
            return this.recipes.map(recipe => {
                const recipeIngredients = this.extractRecipeIngredients(recipe)
                const matchedIngredients = recipeIngredients.filter(ing => {
                    const recipeWords = ing.toLowerCase().trim().split(/\s+/);
                    return this.availableIngredients.some(avail => {
                        const inventoryWords = avail.toLowerCase().trim().split(/\s+/);
                        return recipeWords.every(word => inventoryWords.includes(word));
                    });
                })
                
                const expiringMatchedIngredients = matchedIngredients.filter(ing => {
                    const recipeWords = ing.toLowerCase().trim().split(/\s+/);
                    return this.expiringIngredientNames.some(expiring => {
                        const expiringWords = expiring.toLowerCase().trim().split(/\s+/);
                        return recipeWords.every(word => expiringWords.includes(word));
                    });
                })
                
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
                    expiringMatchedIngredients,
                    missingIngredients,
                    totalIngredients: recipeIngredients.length
                }
            }).sort((a, b) => {
                if (this.filters.useExpiringOnly) {
                    if (a.expiringMatchedIngredients.length !== b.expiringMatchedIngredients.length) {
                        return b.expiringMatchedIngredients.length - a.expiringMatchedIngredients.length
                    }
                }
                return b.matchPercentage - a.matchPercentage
            })
        },
        
        // Sorted ingredients for modal display (shows available first then missing)
        sortedRecipeIngredients() {
            if (!this.selectedRecipe) return []
            
            const recipeIngredients = this.extractRecipeIngredients(this.selectedRecipe)
            const ingredientsWithStatus = recipeIngredients.map((ingredient, index) => {
                const isAvailable = this.isIngredientAvailable(ingredient)
                const isExpiring = this.isIngredientExpiring(ingredient)
                const measure = this.getIngredientMeasure(this.selectedRecipe, index + 1)
                
                return {
                    name: ingredient,
                    measure: measure,
                    index: index,
                    isAvailable: isAvailable,
                    isExpiring: isExpiring,
                    // Sort priority: expiring first (0), available (1), missing (2)
                    sortOrder: isExpiring ? 0 : (isAvailable ? 1 : 2)
                }
            })
            
            // Sort by sortOrder, then alphabetically
            return ingredientsWithStatus.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder
                }
                return a.name.localeCompare(b.name)
            })
        }
    },
    
    methods: {
        async fetchSession() {
            try {
                const { data, error } = await supabase.auth.getSession()
                if (error) {
                    console.error('Error fetching session:', error)
                    return
                }
                this.session = data.session
            } catch (error) {
                console.error('Error in fetchSession:', error)
            }
        },

        async fetchHouseholdId() {
            if (!this.session) {
                console.warn('No session available')
                return
            }

            try {
                const userId = this.session.user.id
                const { data: households, error } = await supabase
                    .from('households')
                    .select('id')
                    .eq('created_by', userId)
                    .limit(1)

                if (error) {
                    console.error('Error fetching household:', error)
                    return
                }

                if (households.length > 0) {
                    this.householdId = households[0].id
                    console.log('Household ID fetched:', this.householdId)
                } else {
                    console.warn('No household found for user.')
                }
            } catch (error) {
                console.error('Error in fetchHouseholdId:', error)
            }
        },
        
        async fetchInventory() {
            if (!this.householdId) {
                console.warn('No household ID available for fetching inventory')
                return
            }

            try {
                console.log('Fetching inventory for household:', this.householdId)
                
                const { data, error } = await supabase
                    .from('ingredients')
                    .select(`
                        id,
                        name,
                        category,
                        unit,
                        ingredient_batches (
                            id,
                            quantity,
                            expiry_date,
                            status
                        )
                    `)
                    .eq('household_id', this.householdId)
                
                if (error) throw error
                
                this.inventory = data.map(ingredient => ({
                    id: ingredient.id,
                    name: ingredient.name,
                    category: ingredient.category,
                    unit: ingredient.unit,
                    batches: ingredient.ingredient_batches || []
                }))
                
                console.log('Fetched inventory:', this.inventory)
                console.log('Number of items:', this.inventory.length)
                
                if (this.inventory.length === 0) {
                    console.warn('No inventory items found! Check your household_id:', this.householdId)
                }
            } catch (error) {
                console.error('Error fetching inventory:', error)
                this.error = 'Failed to load inventory'
            }
        },
        
        async fetchExpiringIngredients() {
            if (!this.householdId) {
                console.warn('No household ID available for fetching expiring ingredients')
                return
            }

            try {
                const today = new Date().toISOString().split('T')[0]
                const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    .toISOString().split('T')[0]
                
                const { data, error } = await supabase
                    .from('ingredient_batches')
                    .select(`
                        id,
                        quantity,
                        expiry_date,
                        status,
                        ingredient:ingredients!inner (
                            id,
                            name,
                            category,
                            household_id
                        )
                    `)
                    .eq('ingredient.household_id', this.householdId)
                    .eq('status', 'active')
                    .gte('expiry_date', today)
                    .lte('expiry_date', sevenDaysFromNow)
                    .order('expiry_date', { ascending: true })
                
                if (error) throw error
                
                const uniqueIngredients = new Map()
                data.forEach(batch => {
                    if (batch.ingredient && !uniqueIngredients.has(batch.ingredient.id)) {
                        uniqueIngredients.set(batch.ingredient.id, {
                            id: batch.ingredient.id,
                            name: batch.ingredient.name,
                            category: batch.ingredient.category,
                            expiryDate: batch.expiry_date,
                            quantity: batch.quantity
                        })
                    }
                })
                
                this.expiringIngredients = Array.from(uniqueIngredients.values())
                console.log('Expiring ingredients:', this.expiringIngredients)
            } catch (error) {
                console.error('Error fetching expiring ingredients:', error)
            }
        },
        
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
        
        getIngredientMeasure(recipe, index) {
            return recipe[`strMeasure${index}`] || ''
        },
        
        async fetchRecipesByIngredient(ingredient) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`
                )
                const data = await response.json()
                return data.meals || []
            } catch (error) {
                console.error('Error fetching recipes for ingredient:', ingredient, error)
                return []
            }
        },
        
        async fetchRecipeDetails(mealId) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`
                )
                const data = await response.json()
                return data.meals ? data.meals[0] : null
            } catch (error) {
                console.error('Error fetching recipe details:', error)
                return null
            }
        },
        
        async loadRecipes() {
            this.loading = true
            this.error = null
            
            try {
                let recipes = []
                
                if (this.filters.cuisine) {
                    const response = await fetch(
                        `https://www.themealdb.com/api/json/v1/1/filter.php?a=${this.filters.cuisine}`
                    )
                    const data = await response.json()
                    const basicRecipes = data.meals || []
                    
                    const detailPromises = basicRecipes.slice(0, 20).map(recipe => 
                        this.fetchRecipeDetails(recipe.idMeal)
                    )
                    recipes = await Promise.all(detailPromises)
                    recipes = recipes.filter(r => r !== null)
                    
                } else if (this.filters.dietaryPreference) {
                    const response = await fetch(
                        `https://www.themealdb.com/api/json/v1/1/filter.php?c=${this.filters.dietaryPreference}`
                    )
                    const data = await response.json()
                    const basicRecipes = data.meals || []
                    
                    const detailPromises = basicRecipes.slice(0, 20).map(recipe => 
                        this.fetchRecipeDetails(recipe.idMeal)
                    )
                    recipes = await Promise.all(detailPromises)
                    recipes = recipes.filter(r => r !== null)
                    
                } else {
                    const recipeMap = new Map()
                    
                    for (const ingredient of this.availableIngredients.slice(0, 5)) {
                        const foundRecipes = await this.fetchRecipesByIngredient(ingredient)
                        for (const recipe of foundRecipes.slice(0, 10)) {
                            if (!recipeMap.has(recipe.idMeal)) {
                                const details = await this.fetchRecipeDetails(recipe.idMeal)
                                if (details) {
                                    recipeMap.set(recipe.idMeal, details)
                                }
                            }
                        }
                    }
                    
                    recipes = Array.from(recipeMap.values())
                }
                
                this.recipes = recipes
                this.applyFilters()
                
            } catch (error) {
                console.error('Error loading recipes:', error)
                this.error = 'Failed to load recipes'
            } finally {
                this.loading = false
            }
        },
        
        applyFilters() {
            let filtered = this.recipesWithMatch
            
            if (this.filters.searchQuery) {
                const query = this.filters.searchQuery.toLowerCase()
                filtered = filtered.filter(recipe => 
                    recipe.strMeal.toLowerCase().includes(query)
                )
            }
            
            if (this.filters.maxTime) {
                // Placeholder for time filter
            }
            
            if (this.filters.useExpiringOnly) {
                filtered = filtered.filter(recipe => 
                    recipe.expiringMatchedIngredients.length > 0
                )
            }
            
            this.filteredRecipes = filtered
        },
        
        clearFilters() {
            this.filters = {
                cuisine: '',
                maxTime: '',
                dietaryPreference: '',
                searchQuery: '',
                useExpiringOnly: false
            }
            this.applyFilters()
        },
        
        showRecipeDetails(recipe) {
            this.selectedRecipe = recipe
        },
        
        closeRecipeModal() {
            this.selectedRecipe = null
        },
        
        getMatchClass(percentage) {
            if (percentage >= 80) return 'match-excellent'
            if (percentage >= 60) return 'match-good'
            if (percentage >= 40) return 'match-fair'
            return 'match-low'
        },
        
        isIngredientAvailable(ingredientName) {
            const recipeIngredient = ingredientName.toLowerCase().trim();
            const recipeWords = recipeIngredient.split(/\s+/);
            
            return this.availableIngredients.some(inventoryItem => {
                const invItem = inventoryItem.toLowerCase().trim();
                const inventoryWords = invItem.split(/\s+/);
                
                // All exact words from recipe ingredient must appear in inventory item
                return recipeWords.every(word => inventoryWords.includes(word));
            });
        },
        
        isIngredientExpiring(ingredientName) {
            const recipeIngredient = ingredientName.toLowerCase().trim();
            const recipeWords = recipeIngredient.split(/\s+/);
            
            return this.expiringIngredientNames.some(expiring => {
                const expiringWords = expiring.toLowerCase().trim().split(/\s+/);
                // All words from recipe ingredient must appear in expiring item
                return recipeWords.every(word => expiringWords.includes(word));
            });
        },
        
        async prepareUseRecipe(recipe) {
            this.recipeToUse = recipe
            this.ingredientsToDeduct = []
            
            const recipeIngredients = this.extractRecipeIngredients(recipe)
            
            for (let i = 0; i < recipeIngredients.length; i++) {
                const ingredientName = recipeIngredients[i]
                const measure = this.getIngredientMeasure(recipe, i + 1)
                
                // Use precise word-based matching
                const recipeWords = ingredientName.toLowerCase().trim().split(/\s+/);
                const inventoryItem = this.inventory.find(item => {
                    const inventoryWords = item.name.toLowerCase().trim().split(/\s+/);
                    return recipeWords.every(word => inventoryWords.includes(word));
                });
                
                const quantityMatch = measure.match(/(\d+\.?\d*)/)
                const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1
                
                const recipeUnit = measure.replace(/[\d\.\s]+/, '').trim().toLowerCase()
                const inventoryUnit = inventoryItem ? inventoryItem.unit.toLowerCase() : ''
                
                const unitMatch = this.checkUnitCompatibility(recipeUnit, inventoryUnit)
                
                const isExpiring = inventoryItem ? this.isIngredientExpiring(inventoryItem.name) : false
                
                this.ingredientsToDeduct.push({
                    name: ingredientName,
                    measure: measure,
                    recipeUnit: recipeUnit,
                    quantity: quantity,
                    editableQuantity: quantity,
                    available: !!inventoryItem,
                    inventoryItem: inventoryItem,
                    inventoryUnit: inventoryUnit,
                    unitMatch: unitMatch,
                    checked: !!inventoryItem,
                    isExpiring: isExpiring
                })
            }
            
            this.ingredientsToDeduct.sort((a, b) => {
                if (a.isExpiring && !b.isExpiring) return -1
                if (!a.isExpiring && b.isExpiring) return 1
                if (a.available && !b.available) return -1
                if (!a.available && b.available) return 1
                return 0
            })
            
            this.showUseRecipeConfirmation = true
        },
        
        checkUnitCompatibility(recipeUnit, inventoryUnit) {
            if (!recipeUnit || !inventoryUnit) return 'unknown'
            
            if (recipeUnit === inventoryUnit) return 'exact'
            
            const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'oz', 'lb', 'lbs', 'pound', 'pounds', 'ounce', 'ounces']
            const isRecipeWeight = weightUnits.some(u => recipeUnit.includes(u))
            const isInventoryWeight = weightUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeWeight && isInventoryWeight) return 'compatible'
            
            const volumeUnits = ['l', 'ml', 'liter', 'liters', 'milliliter', 'milliliters', 'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'teaspoon', 'fl oz', 'fluid ounce']
            const isRecipeVolume = volumeUnits.some(u => recipeUnit.includes(u))
            const isInventoryVolume = volumeUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeVolume && isInventoryVolume) return 'compatible'
            
            const countUnits = ['pcs', 'pc', 'piece', 'pieces', 'pack', 'packs', 'item', 'items', 'unit', 'units']
            const isRecipeCount = countUnits.some(u => recipeUnit.includes(u))
            const isInventoryCount = countUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeCount && isInventoryCount) return 'compatible'
            
            if (!recipeUnit || recipeUnit === '') return 'compatible'
            
            return 'mismatch'
        },
        
        cancelUseRecipe() {
            this.showUseRecipeConfirmation = false
            this.recipeToUse = null
            this.ingredientsToDeduct = []
        },
        
        async confirmUseRecipe() {
            this.usingRecipe = true
            
            try {
                const deductionRecord = {
                    recipeId: this.recipeToUse.idMeal,
                    recipeName: this.recipeToUse.strMeal,
                    timestamp: new Date().toISOString(),
                    deductions: []
                }
                
                for (const ingredient of this.ingredientsToDeduct) {
                    if (ingredient.checked && ingredient.available && ingredient.inventoryItem) {
                        const deduction = await this.deductIngredientFromInventory(
                            ingredient.inventoryItem,
                            ingredient.editableQuantity
                        )
                        if (deduction) {
                            deductionRecord.deductions.push(deduction)
                        }
                    }
                }
                
                this.lastDeduction = deductionRecord
                
                await this.fetchInventory()
                await this.fetchExpiringIngredients()
                
                this.showUseRecipeConfirmation = false
                this.closeRecipeModal()
                
                this.showUndoNotification = true
                
                if (this.undoTimer) clearTimeout(this.undoTimer)
                this.undoTimer = setTimeout(() => {
                    this.showUndoNotification = false
                    this.lastDeduction = null
                }, 15000)
                
            } catch (error) {
                console.error('Error using recipe:', error)
                alert('Failed to use recipe. Please try again.')
            } finally {
                this.usingRecipe = false
            }
        },
        
        async deductIngredientFromInventory(inventoryItem, quantityNeeded) {
            try {
                const sortedBatches = [...inventoryItem.batches]
                    .filter(batch => batch.status === 'active' || !batch.status)
                    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
                
                let remainingQuantity = quantityNeeded
                const batchUpdates = []
                
                for (const batch of sortedBatches) {
                    if (remainingQuantity <= 0) break
                    
                    const currentQuantity = parseFloat(batch.quantity)
                    
                    if (currentQuantity > 0) {
                        const deductAmount = Math.min(currentQuantity, remainingQuantity)
                        const newQuantity = currentQuantity - deductAmount
                        
                        const { error } = await supabase
                            .from('ingredient_batches')
                            .update({ 
                                quantity: newQuantity,
                                status: newQuantity <= 0 ? 'depleted' : 'active'
                            })
                            .eq('id', batch.id)
                        
                        if (error) throw error
                        
                        batchUpdates.push({
                            batchId: batch.id,
                            previousQuantity: currentQuantity,
                            deductedAmount: deductAmount,
                            newQuantity: newQuantity,
                            previousStatus: batch.status || 'active'
                        })
                        
                        remainingQuantity -= deductAmount
                    }
                }
                
                return {
                    ingredientId: inventoryItem.id,
                    ingredientName: inventoryItem.name,
                    totalDeducted: quantityNeeded - remainingQuantity,
                    batchUpdates: batchUpdates
                }
                
            } catch (error) {
                console.error('Error deducting ingredient:', error)
                return null
            }
        },
        
        async undoRecipeUse() {
            if (!this.lastDeduction) return
            
            try {
                for (const deduction of this.lastDeduction.deductions) {
                    for (const batchUpdate of deduction.batchUpdates) {
                        const { error } = await supabase
                            .from('ingredient_batches')
                            .update({ 
                                quantity: batchUpdate.previousQuantity,
                                status: batchUpdate.previousStatus
                            })
                            .eq('id', batchUpdate.batchId)
                        
                        if (error) throw error
                    }
                }
                
                await this.fetchInventory()
                await this.fetchExpiringIngredients()
                
                this.showUndoNotification = false
                this.lastDeduction = null
                
                if (this.undoTimer) {
                    clearTimeout(this.undoTimer)
                    this.undoTimer = null
                }
                
                alert('Recipe use has been undone successfully!')
                
            } catch (error) {
                console.error('Error undoing recipe use:', error)
                alert('Failed to undo. Please check your inventory manually.')
            }
        },
        
        dismissUndo() {
            this.showUndoNotification = false
            this.lastDeduction = null
            if (this.undoTimer) {
                clearTimeout(this.undoTimer)
                this.undoTimer = null
            }
        }
    },
    
    watch: {
        filters: {
            handler() {
                this.applyFilters()
            },
            deep: true
        },
        
        householdId(newVal) {
            if (newVal) {
                this.fetchInventory()
                this.fetchExpiringIngredients()
            }
        }
    },
    
    async mounted() {
        await this.fetchSession()
        await this.fetchHouseholdId()
        
        if (this.householdId) {
            await this.fetchInventory()
            await this.fetchExpiringIngredients()
            await this.loadRecipes()
        } else {
            console.error('Unable to load recipes: No household ID available')
            this.error = 'Unable to load your household data. Please make sure you have a household set up.'
        }
    },
    
    beforeUnmount() {
        if (this.undoTimer) {
            clearTimeout(this.undoTimer)
        }
    }
}
</script>

<template>
    <div class="recipes-container">
        <!-- Header -->
        <div class="recipes-header">
            <h1>Recipe Suggestions</h1>
            <p class="subtitle">Based on your available ingredients</p>
            
            <div v-if="expiringIngredients.length > 0" class="expiring-alert">
                <strong>⚠️ {{ expiringIngredients.length }} ingredient(s) expiring soon!</strong>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                    <li v-for="(item, index) in expiringIngredients" :key="item.id">
                        {{ item.name }}
                    </li>
                </ul>
            </div>
        </div>

        <!-- Filters Section -->
        <div class="filters-section">
            <h3>Filter Recipes</h3>
            
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Search by name</label>
                    <input 
                        type="text" 
                        class="form-control" 
                        v-model="filters.searchQuery"
                        placeholder="e.g., Pasta, Chicken..."
                    >
                </div>

                <div class="col-md-6">
                    <label class="form-label">Cuisine</label>
                    <select class="form-select" v-model="filters.cuisine" @change="loadRecipes">
                        <option value="">All Cuisines</option>
                        <option v-for="cuisine in cuisines" :key="cuisine" :value="cuisine">
                            {{ cuisine }}
                        </option>
                    </select>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Dietary Preference</label>
                    <select class="form-select" v-model="filters.dietaryPreference" @change="loadRecipes">
                        <option value="">All Types</option>
                        <option v-for="diet in dietaryOptions" :key="diet" :value="diet">
                            {{ diet }}
                        </option>
                    </select>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Max Cooking Time (minutes)</label>
                    <input 
                        type="number" 
                        class="form-control" 
                        v-model="filters.maxTime"
                        placeholder="e.g., 30"
                        min="0"
                    >
                </div>

                <div class="col-12">
                    <div class="form-check">
                        <input 
                            class="form-check-input" 
                            type="checkbox" 
                            id="expiringOnly"
                            v-model="filters.useExpiringOnly"
                        >
                        <label class="form-check-label" for="expiringOnly">
                            <strong>Show only recipes using expiring ingredients</strong>
                        </label>
                    </div>
                </div>
            </div>

            <div class="mt-3">
                <button class="btn btn-secondary" @click="clearFilters">Clear Filters</button>
                <button class="btn btn-primary ms-2" @click="loadRecipes">Refresh Recipes</button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <RecipeLoadingSkeleton v-if="loading" :skeleton-count="6" />
            <p class="mt-3">Finding delicious recipes...</p>
        </div>

        <!-- Error State -->
        <div v-if="error" class="alert alert-danger">
            {{ error }}
        </div>

        <!-- Recipes Grid -->
        <div v-if="!loading && !error" class="recipes-grid">
            <div 
                v-for="recipe in filteredRecipes" 
                :key="recipe.idMeal"
                class="recipe-card"
                @click="showRecipeDetails(recipe)"
            >
                <div class="recipe-image-container">
                    <img :src="recipe.strMealThumb" :alt="recipe.strMeal" class="recipe-image">
                    
                    <div class="match-badge" :class="getMatchClass(recipe.matchPercentage)">
                        {{ recipe.matchPercentage }}% Match
                    </div>
                    
                    <div v-if="recipe.expiringMatchedIngredients.length > 0" class="expiring-badge">
                        ⏰ Uses {{ recipe.expiringMatchedIngredients.length }} expiring
                    </div>
                </div>

                <div class="recipe-content">
                    <h4 class="recipe-title">{{ recipe.strMeal }}</h4>
                    
                    <div class="recipe-meta">
                        <span class="badge bg-info">{{ recipe.strArea }}</span>
                        <span class="badge bg-secondary">{{ recipe.strCategory }}</span>
                    </div>

                    <div class="ingredient-summary">
                        <p class="mb-1">
                            <strong>✓ {{ recipe.matchedIngredients.length }}</strong> / 
                            {{ recipe.totalIngredients }} ingredients available
                        </p>
                        
                        <div v-if="recipe.expiringMatchedIngredients.length > 0" class="expiring-ingredients">
                            <small>
                                <strong>⏰ Expiring soon:</strong>
                                {{ recipe.expiringMatchedIngredients.join(', ') }}
                            </small>
                        </div>
                        
                        <div v-if="recipe.missingIngredients.length > 0" class="missing-ingredients">
                            <small class="text-muted">
                                <strong>Missing:</strong> {{ recipe.missingIngredients.slice(0, 3).join(', ') }}
                                <span v-if="recipe.missingIngredients.length > 3">...</span>
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- No Results -->
            <div v-if="filteredRecipes.length === 0" class="col-12 text-center my-5">
                <p class="text-muted">No recipes found matching your criteria.</p>
                <button class="btn btn-primary" @click="clearFilters">Clear Filters</button>
            </div>
        </div>

        <!-- RECIPE DETAIL MODAL -->
        <div v-if="selectedRecipe" class="recipe-modal" @click.self="closeRecipeModal">
            <div class="recipe-modal-content recipe-detail-modal-styled">
                <button class="btn-close-modal" @click="closeRecipeModal">&times;</button>
                
                <div class="recipe-detail-layout-styled">
                    <!-- Left Side: Recipe Image with Info Cards & buttons -->
                    <div class="recipe-detail-left">
                        <div class="recipe-image-wrapper">
                            <img 
                                :src="selectedRecipe.strMealThumb" 
                                :alt="selectedRecipe.strMeal" 
                                class="detail-recipe-image-styled"
                            >
                        </div>
                        
                        <!-- Match Badge Card -->
                        <div class="match-card" :class="getMatchClass(selectedRecipe.matchPercentage)">
                            <div class="match-percentage">{{ selectedRecipe.matchPercentage }}%</div>
                            <div class="match-text">Ingredient Match</div>
                        </div>
                        
                        <!-- Expiring Ingredients Card -->
                        <div v-if="selectedRecipe.expiringMatchedIngredients.length > 0" class="expiring-card">
                            <div class="expiring-icon">🔥</div>
                            <div class="expiring-text">
                                <strong>Expiring Ingredients</strong>
                                <p>{{ selectedRecipe.expiringMatchedIngredients.join(', ') }}</p>
                            </div>
                        </div>
                        
                        <!-- ACTION BUTTONS -->
                        <div class="recipe-modal-actions-sidebar">
                            <a v-if="selectedRecipe.strYoutube" 
                               :href="selectedRecipe.strYoutube" 
                               target="_blank" 
                               class="btn btn-danger btn-sidebar">
                                <svg class="youtube-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                Watch Video
                            </a>
                            <button class="btn btn-success btn-sidebar" @click="prepareUseRecipe(selectedRecipe)">
                                Use This Recipe
                            </button>
                        </div>
                    </div>

                    <!-- Right Side: Ingredients & Instructions -->
                    <div class="recipe-detail-right">
                        <div class="recipe-title-section">
                            <h2 class="recipe-modal-title">{{ selectedRecipe.strMeal }}</h2>
                            <div class="recipe-modal-badges">
                                <span class="badge bg-secondary">{{ selectedRecipe.strCategory }}</span>
                                <span class="badge bg-info">{{ selectedRecipe.strArea }}</span>
                            </div>
                        </div>
                        
                        <div class="recipe-scrollable-content">
                            <h4 class="section-heading">Ingredients</h4>
                            <ul class="ingredients-list-styled">
                                <li 
                                    v-for="ingredient in sortedRecipeIngredients" 
                                    :key="ingredient.index"
                                    class="ingredient-item-styled"
                                    :class="{
                                        'ingredient-available-styled': ingredient.isAvailable && !ingredient.isExpiring,
                                        'ingredient-expiring-styled': ingredient.isExpiring,
                                        'ingredient-missing-styled': !ingredient.isAvailable
                                    }"
                                >
                                    <span class="ingredient-check-icon">
                                        <span v-if="ingredient.isExpiring" class="icon-container">
                                            <span class="check-icon">✓</span>
                                            <span class="fire-icon">🔥</span>
                                        </span>
                                        <span v-else>
                                            {{ ingredient.isAvailable ? '✓' : '✗' }}
                                        </span>
                                    </span>
                                    <span class="ingredient-text-styled">
                                        {{ ingredient.measure }} {{ ingredient.name }}
                                    </span>
                                </li>
                            </ul>

                            <h4 class="section-heading">Instructions</h4>
                            <div class="instructions-styled">
                                {{ selectedRecipe.strInstructions }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Use Recipe Confirmation Modal -->
        <div v-if="showUseRecipeConfirmation" class="recipe-modal" @click.self="cancelUseRecipe">
            <div class="recipe-modal-content use-recipe-modal-new">
                <button class="btn-close-modal" @click="cancelUseRecipe">&times;</button>
                
                <div v-if="recipeToUse" class="recipe-confirmation-layout-new">
                    <!-- Header Section -->
                    <div class="confirmation-header-new">
                        <div class="confirmation-image-left">
                            <img :src="recipeToUse.strMealThumb" :alt="recipeToUse.strMeal" class="confirmation-recipe-image-redesign">
                        </div>
                        <div class="confirmation-info-right">
                            <div class="confirmation-badges-top">
                                <span class="badge bg-secondary">{{ recipeToUse.strCategory }}</span>
                                <span class="badge bg-info">{{ recipeToUse.strArea }}</span>
                            </div>
                            <h2 class="confirmation-recipe-name-new">{{ recipeToUse.strMeal }}</h2>
                            <div class="confirmation-stats">
                                <div class="stat-item">
                                    <div class="stat-value" :class="getMatchClass(recipeToUse.matchPercentage)">
                                        {{ recipeToUse.matchPercentage }}%
                                    </div>
                                    <div class="stat-label">Match</div>
                                </div>
                                <div class="stat-divider"></div>
                                <div class="stat-item">
                                    <div class="stat-value">{{ ingredientsToDeduct.filter(i => i.available).length }}/{{ ingredientsToDeduct.length }}</div>
                                    <div class="stat-label">Available</div>
                                </div>
                                <template v-if="ingredientsToDeduct.filter(i => i.isExpiring).length > 0">
                                    <div class="stat-divider"></div>
                                    <div class="stat-item">
                                        <div class="stat-value expiring-stat">{{ ingredientsToDeduct.filter(i => i.isExpiring).length }}</div>
                                        <div class="stat-label">Expiring</div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ingredients List -->
                    <div class="ingredients-section-redesign">
                        <h3 class="section-title-redesign">
                            <span>Select Ingredients to Use</span>
                            <span class="ingredients-count">{{ ingredientsToDeduct.filter(i => i.checked).length }} selected</span>
                        </h3>
                        
                        <div class="ingredients-list-redesign">
                            <div 
                                v-for="(ingredient, index) in ingredientsToDeduct" 
                                :key="index"
                                class="ingredient-card-redesign"
                                :class="{
                                    'is-expiring': ingredient.isExpiring,
                                    'is-available': ingredient.available && !ingredient.isExpiring,
                                    'is-missing': !ingredient.available,
                                    'is-unchecked': !ingredient.checked
                                }"
                            >
                                <div class="ingredient-card-main">
                                    <!-- Checkbox -->
                                    <div class="ingredient-checkbox-wrapper">
                                        <input 
                                            type="checkbox" 
                                            v-model="ingredient.checked"
                                            :disabled="!ingredient.available"
                                            :id="'ingredient-' + index"
                                            class="custom-checkbox"
                                        >
                                        <label :for="'ingredient-' + index" class="checkbox-label"></label>
                                    </div>
                                    
                                    <!-- Status Indicator -->
                                    <div class="ingredient-status-indicator">
                                        <span v-if="ingredient.isExpiring" class="status-badge badge-expiring">
                                            <span class="icon">⏰</span>
                                        </span>
                                        <span v-else-if="ingredient.available" class="status-badge badge-available">
                                            <span class="icon">✓</span>
                                        </span>
                                        <span v-else class="status-badge badge-missing">
                                            <span class="icon">✗</span>
                                        </span>
                                    </div>
                                    
                                    <!-- Ingredient Info -->
                                    <div class="ingredient-info-wrapper">
                                        <div class="ingredient-name-redesign">{{ ingredient.name }}</div>
                                        <div class="ingredient-measure-redesign">{{ ingredient.measure }}</div>
                                    </div>
                                    
                                    <!-- Quantity Editor -->
                                    <div class="ingredient-quantity-wrapper" v-if="ingredient.available">
                                        <input 
                                            type="number" 
                                            v-model.number="ingredient.editableQuantity"
                                            :disabled="!ingredient.checked"
                                            class="quantity-input-redesign"
                                            step="0.01"
                                            min="0"
                                        >
                                        <span class="quantity-unit-redesign">{{ ingredient.inventoryUnit }}</span>
                                        <span v-if="ingredient.unitMatch === 'mismatch'" 
                                              class="unit-warning" 
                                              title="Unit mismatch - please verify">
                                            ⚠️
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="modal-actions-redesign">
                        <button 
                            class="btn-redesign btn-cancel-redesign" 
                            @click="cancelUseRecipe"
                            :disabled="usingRecipe"
                        >
                            Cancel
                        </button>
                        <button 
                            class="btn-redesign btn-confirm-redesign" 
                            @click="confirmUseRecipe"
                            :disabled="usingRecipe || ingredientsToDeduct.filter(i => i.checked).length === 0"
                        >
                            <span v-if="usingRecipe">
                                <span class="spinner-border spinner-border-sm me-2"></span>
                                Processing...
                            </span>
                            <span v-else>
                                <span class="btn-icon">✓</span>
                                Use Recipe
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Undo Notification Toast -->
        <div v-if="showUndoNotification" class="undo-toast">
            <div class="undo-toast-content">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>✓ Recipe Used Successfully!</strong>
                        <p class="mb-0 mt-1" v-if="lastDeduction">
                            <small>{{ lastDeduction.recipeName }} - Ingredients deducted</small>
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-warning btn-sm" @click="undoRecipeUse">
                            ↶ Undo
                        </button>
                        <button class="btn btn-sm btn-outline-light" @click="dismissUndo">
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
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

.expiring-alert {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 15px;
    margin-top: 15px;
    color: #856404;
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
    padding: 8px 12px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 0.9em;
    color: white;
}

.expiring-badge {
    position: absolute;
    top: 45px;
    right: 10px;
    background: #ff6b6b;
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 0.75em;
    font-weight: 600;
}

.match-badge.match-excellent { background: #28a745; }
.match-badge.match-good { background: #17a2b8; }
.match-badge.match-fair { background: #ffc107; }
.match-badge.match-low { background: #dc3545; }

.recipe-content {
    padding: 20px;
}

.recipe-title {
    font-size: 1.2em;
    margin-bottom: 10px;
    color: #333;
    min-height: 50px;
}

.recipe-meta {
    margin-bottom: 15px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.ingredient-summary {
    font-size: 0.9em;
    color: #666;
}

.expiring-ingredients {
    background: #fff3cd;
    padding: 8px;
    border-radius: 6px;
    margin-top: 8px;
    color: #856404;
}

.missing-ingredients {
    margin-top: 8px;
}

/* Modal Styles */
.recipe-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 20px;
    overflow-y: auto;
}

.recipe-modal-content {
    background: white;
    border-radius: 16px;
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.btn-close-modal {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    z-index: 10;
    transition: background 0.3s, transform 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.btn-close-modal:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
}

/* Recipe Modal Styles */

.recipe-detail-modal-styled {
    max-width: 1000px;
    padding: 0;
    border-radius: 15px;
    overflow: hidden;
}

/* Override any Bootstrap or default button styles */
.recipe-detail-left .btn-sidebar {
    max-width: none !important;
    flex-grow: 1 !important;
}

.recipe-detail-layout-styled {
    display: grid;
    grid-template-columns: 350px 1fr;
    min-height: 700px;
}

/* Left Side: Image, Cards, and Buttons */
.recipe-detail-left {
    background: #f8f9fa;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: stretch;
}

.recipe-image-wrapper {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    box-sizing: border-box;
    margin: 0;
}

.detail-recipe-image-styled {
    width: 100%;
    height: 250px;
    object-fit: cover;
    display: block;
    margin: 0;
    padding: 0;
}

/* Match Badge Card */
.match-card {
    background: linear-gradient(135deg, #ff9a56 0%, #ff6a6a 100%);
    padding: 20px;
    border-radius: 12px;
    color: white;
    text-align: center;
    box-shadow: 0 4px 12px rgba(255, 154, 86, 0.3);
    width: 100%;
    box-sizing: border-box;
    margin: 0;
}

.match-card.match-excellent {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    box-shadow: 0 4px 12px rgba(17, 153, 142, 0.3);
}

.match-card.match-good {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.match-card.match-fair {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    box-shadow: 0 4px 12px rgba(240, 147, 251, 0.3);
}

.match-card.match-low {
    background: linear-gradient(135deg, #ff9a56 0%, #ff6a6a 100%);
    box-shadow: 0 4px 12px rgba(255, 154, 86, 0.3);
}

.match-percentage {
    font-size: 2.5em;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 5px;
}

.match-text {
    font-size: 1em;
    font-weight: 500;
    opacity: 0.95;
}

/* Expiring Ingredients Card */
.expiring-card {
    background: white;
    border: 2px solid #ff6b6b;
    padding: 15px;
    border-radius: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
}

.expiring-icon {
    font-size: 1.8em;
    flex-shrink: 0;
}

.expiring-text {
    flex: 1;
    min-width: 0;
}

.expiring-text strong {
    display: block;
    color: #dc3545;
    font-size: 1em;
    margin-bottom: 5px;
}

.expiring-text p {
    color: #666;
    font-size: 0.9em;
    margin: 0;
    line-height: 1.4;
    word-wrap: break-word;
}

/* Left Sidebar Action Buttons (watch + use) */
.recipe-modal-actions-sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    align-items: stretch;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

.btn-sidebar {
    width: 100%;
    padding: 14px 16px;
    border-radius: 12px;
    text-align: center;
    font-weight: 600;
    font-size: 0.95em;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    box-sizing: border-box;
    margin: 0;
}

.btn-sidebar.btn-danger {
    background: #e52d27;
    color: white;
}

.btn-sidebar.btn-danger:hover {
    background: #c9221c;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(229, 45, 39, 0.4);
    color: white;
}

.btn-sidebar.btn-success {
    background: #28a745;
    color: white;
}

.btn-sidebar.btn-success:hover {
    background: #218838;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

.youtube-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

/* Right Side: Content */
.recipe-detail-right {
    background: white;
    display: flex;
    flex-direction: column;
}

.recipe-title-section {
    padding: 25px 30px;
    border-bottom: 2px solid #f0f0f0;
}

.recipe-modal-title {
    font-size: 1.8em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 12px 0;
}

.recipe-modal-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.recipe-scrollable-content {
    flex: 1;
    padding: 25px 30px 30px 30px;
    overflow-y: auto;
    max-height: calc(100vh - 350px);
    min-height: 450px;
}

/* Custom Scrollbar for recipe content */
.recipe-scrollable-content::-webkit-scrollbar {
    width: 8px;
}

.recipe-scrollable-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.recipe-scrollable-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 10px;
}

.recipe-scrollable-content::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
}

.section-heading {
    font-size: 1.3em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 15px 0;
}

/* Ingredients List Styled */
.ingredients-list-styled {
    list-style: none;
    padding: 0;
    margin: 0 0 30px 0;
}

.ingredient-item-styled {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 15px;
    margin: 6px 0;
    border-radius: 8px;
    font-size: 0.95em;
    transition: all 0.2s;
}

.ingredient-available-styled {
    background: #d4edda;
    border: 1px solid #c3e6cb;
}

.ingredient-expiring-styled {
    background: #fff9e6;
    border: 2px solid #ffc107;
    font-weight: 600;
}

.ingredient-missing-styled {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    opacity: 0.7;
}

.ingredient-check-icon {
    font-size: 1.2em;
    font-weight: bold;
    flex-shrink: 0;
    width: 40px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-container {
    display: flex;
    align-items: center;
    gap: 3px;
}

.check-icon {
    font-size: 1em;
}

.fire-icon {
    font-size: 0.95em;
}

.ingredient-available-styled .ingredient-check-icon {
    color: #28a745;
}

.ingredient-expiring-styled .ingredient-check-icon {
    color: #f39c12;
}

.ingredient-missing-styled .ingredient-check-icon {
    color: #dc3545;
}

.ingredient-text-styled {
    flex: 1;
    color: #2c3e50;
}

/* Instructions Styled */
.instructions-styled {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    line-height: 1.8;
    color: #555;
    white-space: pre-wrap;
    font-size: 0.95em;
    margin-bottom: 0;
}

/* Responsive for styled modal */
@media (max-width: 900px) {
    .recipe-detail-layout-styled {
        grid-template-columns: 1fr;
    }
    
    .recipe-detail-left {
        padding: 20px;
    }
    
    .detail-recipe-image-styled {
        height: 200px;
    }
    
    .recipe-scrollable-content {
        max-height: calc(100vh - 400px);
        min-height: 300px;
    }
}

/* ========== REDESIGNED CONFIRMATION MODAL STYLES ========== */

.use-recipe-modal-new {
    max-width: 850px;
    max-height: 90vh;
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.recipe-confirmation-layout-new {
    padding: 0;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    min-height: auto;
    overflow: hidden;
}

/* Header Section - Redesigned */
.confirmation-header-new {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 30px;
    padding: 30px;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border-bottom: 1px solid #e9ecef;
    flex-shrink: 0;
}

/* Prevent any match-badge styles from bleeding into stats */
.confirmation-header-new .stat-value {
    border-radius: 0;
}

.confirmation-image-left {
    position: relative;
}

.confirmation-recipe-image-redesign {
    width: 100%;
    height: 200px;
    border-radius: 12px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.confirmation-info-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
}

.confirmation-badges-top {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.confirmation-recipe-name-new {
    font-size: 1.75em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0;
    line-height: 1.3;
}

.confirmation-stats {
    display: flex;
    align-items: stretch;
    gap: 20px;
    margin-top: 16px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 75px;
    flex: 0 0 auto;
}

.stat-value {
    font-size: 2em;
    font-weight: 700;
    color: #2c3e50;
    line-height: 1.2;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: transparent !important;
    padding: 0;
    border: none;
}

.stat-label {
    font-size: 0.65em;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    white-space: nowrap;
    text-align: center;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-divider {
    width: 1px;
    height: 100%;
    background: #dee2e6;
    align-self: stretch;
    margin: 0;
}

.stat-value.match-excellent { 
    color: #28a745;
}
.stat-value.match-good { 
    color: #17a2b8;
}
.stat-value.match-fair { 
    color: #ffc107;
}
.stat-value.match-low { 
    color: #dc3545;
}
.stat-value.expiring-stat { 
    color: #ff6b6b;
}

/* Ingredients Section - Redesigned */
.ingredients-section-redesign {
    padding: 30px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

.ingredients-section-redesign::-webkit-scrollbar {
    width: 6px;
}

.ingredients-section-redesign::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 10px;
}

.ingredients-section-redesign::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 10px;
}

.ingredients-section-redesign::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}

.section-title-redesign {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.3em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 20px 0;
}

.ingredients-count {
    font-size: 0.7em;
    font-weight: 600;
    color: #6c757d;
    background: #f8f9fa;
    padding: 4px 12px;
    border-radius: 12px;
}

.ingredients-list-redesign {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 8px;
}

/* Ingredient Card - Redesigned */
.ingredient-card-redesign {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    padding: 16px;
    transition: all 0.2s ease;
}

.ingredient-card-redesign.is-expiring {
    border-color: #ffc107;
    background: #fffbf0;
}

.ingredient-card-redesign.is-available {
    border-color: #d4edda;
}

.ingredient-card-redesign.is-missing {
    border-color: #f8d7da;
    background: #fef5f6;
    opacity: 0.7;
}

.ingredient-card-redesign.is-unchecked {
    opacity: 0.6;
}

.ingredient-card-redesign:hover:not(.is-missing) {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ingredient-card-main {
    display: flex;
    align-items: center;
    gap: 14px;
}

/* Custom Checkbox */
.ingredient-checkbox-wrapper {
    position: relative;
    flex-shrink: 0;
}

.custom-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
}

.checkbox-label {
    display: block;
    width: 22px;
    height: 22px;
    border: 2px solid #cbd5e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
}

.custom-checkbox:checked + .checkbox-label {
    background: #4CAF50;
    border-color: #4CAF50;
}

.custom-checkbox:checked + .checkbox-label::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
}

.custom-checkbox:disabled + .checkbox-label {
    background: #e9ecef;
    border-color: #dee2e6;
    cursor: not-allowed;
}

/* Status Indicator */
.ingredient-status-indicator {
    flex-shrink: 0;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 1em;
}

.badge-expiring {
    background: #fff3cd;
    color: #856404;
}

.badge-available {
    background: #d4edda;
    color: #155724;
}

.badge-missing {
    background: #f8d7da;
    color: #721c24;
}

/* Ingredient Info */
.ingredient-info-wrapper {
    flex: 1;
    min-width: 0;
}

.ingredient-name-redesign {
    font-size: 1em;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 2px;
}

.ingredient-measure-redesign {
    font-size: 0.875em;
    color: #6c757d;
}

/* Quantity Editor */
.ingredient-quantity-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.quantity-input-redesign {
    width: 70px;
    padding: 8px 10px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    text-align: center;
    font-size: 0.95em;
    font-weight: 600;
    color: #2c3e50;
    transition: all 0.2s;
}

.quantity-input-redesign:focus {
    border-color: #4CAF50;
    outline: none;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.quantity-input-redesign:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
    opacity: 0.6;
}

.quantity-unit-redesign {
    font-size: 0.875em;
    font-weight: 600;
    color: #6c757d;
    min-width: 30px;
}

.unit-warning {
    font-size: 1.2em;
    cursor: help;
}

/* Action Buttons*/
.modal-actions-redesign {
    display: flex;
    gap: 12px;
    padding: 20px 30px;
    border-top: 1px solid #e9ecef;
    background: #f8f9fa;
    flex-shrink: 0;
}

.btn-redesign {
    flex: 1;
    padding: 14px 24px;
    font-size: 1.05em;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-redesign:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-cancel-redesign {
    background: white;
    color: #6c757d;
    border: 2px solid #dee2e6;
}

.btn-cancel-redesign:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #adb5bd;
}

.btn-confirm-redesign {
    background: #4CAF50;
    color: white;
}

.btn-confirm-redesign:hover:not(:disabled) {
    background: #45a049;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-icon {
    font-size: 1.1em;
}

/* Responsive */
@media (max-width: 768px) {
    .use-recipe-modal-new {
        max-height: 95vh;
    }
    
    .confirmation-header-new {
        grid-template-columns: 1fr;
        text-align: center;
        padding: 20px;
    }
    
    .confirmation-recipe-image-redesign {
        height: 150px;
        margin: 0 auto;
        max-width: 200px;
    }
    
    .confirmation-stats {
        justify-content: center;
    }
    
    .ingredients-section-redesign {
        padding: 20px;
    }
    
    .ingredient-card-main {
        flex-wrap: wrap;
    }
    
    .ingredient-quantity-wrapper {
        width: 100%;
        justify-content: flex-start;
        margin-top: 8px;
    }
    
    .modal-actions-redesign {
        flex-direction: column;
        padding: 15px 20px;
    }
}

/* Undo Toast Notification */
.undo-toast {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 2000;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.undo-toast-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    min-width: 350px;
    max-width: 500px;
}

.undo-toast-content strong {
    font-size: 1.1em;
}

.undo-toast-content small {
    color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 768px) {
    .undo-toast {
        bottom: 20px;
        right: 20px;
        left: 20px;
    }
    
    .undo-toast-content {
        min-width: auto;
    }
}
</style>