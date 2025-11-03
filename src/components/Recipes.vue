<script>
import { supabase } from '@/lib/supabase.js'

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
                const matchedIngredients = recipeIngredients.filter(ing => 
                    this.availableIngredients.some(avail => 
                        avail.includes(ing.toLowerCase()) || ing.toLowerCase().includes(avail)
                    )
                )
                
                const expiringMatchedIngredients = matchedIngredients.filter(ing =>
                    this.expiringIngredientNames.some(expiring =>
                        expiring.includes(ing.toLowerCase()) || ing.toLowerCase().includes(expiring)
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
        
        // NEW: Sorted ingredients for modal display (available first, then missing)
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
            return this.availableIngredients.some(avail => 
                avail.includes(ingredientName.toLowerCase()) || 
                ingredientName.toLowerCase().includes(avail)
            )
        },
        
        isIngredientExpiring(ingredientName) {
            return this.expiringIngredientNames.some(expiring =>
                expiring.includes(ingredientName.toLowerCase()) ||
                ingredientName.toLowerCase().includes(expiring)
            )
        },
        
        async prepareUseRecipe(recipe) {
            this.recipeToUse = recipe
            this.ingredientsToDeduct = []
            
            const recipeIngredients = this.extractRecipeIngredients(recipe)
            
            for (let i = 0; i < recipeIngredients.length; i++) {
                const ingredientName = recipeIngredients[i]
                const measure = this.getIngredientMeasure(recipe, i + 1)
                
                const inventoryItem = this.inventory.find(item => 
                    item.name.toLowerCase().includes(ingredientName.toLowerCase()) ||
                    ingredientName.toLowerCase().includes(item.name.toLowerCase())
                )
                
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
                }, 5000)
                
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

        <!-- ========== UPDATED RECIPE DETAIL MODAL (OPTION 1) ========== -->
        <div v-if="selectedRecipe" class="recipe-modal" @click.self="closeRecipeModal">
            <div class="recipe-modal-content recipe-detail-modal-styled">
                <button class="btn-close-modal" @click="closeRecipeModal">&times;</button>
                
                <div class="recipe-detail-layout-styled">
                    <!-- Left Side: Recipe Image with Info Cards & BUTTONS -->
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
                        
                        <!-- ACTION BUTTONS (OPTION 1) -->
                        <div class="recipe-modal-actions-sidebar">
                            <a v-if="selectedRecipe.strYoutube" 
                               :href="selectedRecipe.strYoutube" 
                               target="_blank" 
                               class="btn btn-danger btn-sidebar">
                                <svg class="youtube-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                Watch Video Tutorial
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
                                        {{ ingredient.isExpiring ? '✓ 🔥' : 
                                           ingredient.isAvailable ? '✓' : '✗' }}
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
                    <div class="confirmation-header">
                        <div class="confirmation-title-section">
                            <h2 class="confirmation-recipe-name">{{ recipeToUse.strMeal }}</h2>
                            <div class="confirmation-badges">
                                <span class="badge bg-secondary">{{ recipeToUse.strCategory }}</span>
                                <span class="badge bg-info">{{ recipeToUse.strArea }}</span>
                            </div>
                        </div>
                        <div class="confirmation-image-wrapper">
                            <img :src="recipeToUse.strMealThumb" :alt="recipeToUse.strMeal" class="confirmation-recipe-image-small">
                        </div>
                    </div>
                    
                    <!-- Match Info Card -->
                    <div class="match-info-card">
                        <div class="match-percentage-new" :class="getMatchClass(recipeToUse.matchPercentage)">
                            <div class="match-circle">
                                <span class="match-number">{{ recipeToUse.matchPercentage }}%</span>
                            </div>
                            <span class="match-label">Ingredient Match</span>
                        </div>
                        
                        <div v-if="ingredientsToDeduct.filter(i => i.isExpiring).length > 0" 
                             class="expiring-alert-new">
                            <div class="expiring-icon-wrapper">
                                <span class="expiring-icon-large">⏰</span>
                            </div>
                            <div class="expiring-content">
                                <strong>Expiring Soon</strong>
                                <p class="mb-0">
                                    {{ ingredientsToDeduct.filter(i => i.isExpiring).map(i => i.name).join(', ') }}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ingredients List -->
                    <div class="ingredients-section-new">
                        <h3 class="section-title-new">Select Ingredients to Deduct</h3>
                        <p class="section-subtitle">Review and adjust quantities before confirming</p>
                        
                        <div class="ingredients-list-new">
                            <div 
                                v-for="(ingredient, index) in ingredientsToDeduct" 
                                :key="index"
                                class="ingredient-card"
                                :class="{
                                    'ingredient-expiring-card': ingredient.isExpiring,
                                    'ingredient-available-card': ingredient.available && !ingredient.isExpiring,
                                    'ingredient-missing-card': !ingredient.available,
                                    'ingredient-unchecked-card': !ingredient.checked
                                }"
                            >
                                <div class="ingredient-card-content">
                                    <!-- Left: Checkbox and Status -->
                                    <div class="ingredient-left">
                                        <input 
                                            type="checkbox" 
                                            v-model="ingredient.checked"
                                            :disabled="!ingredient.available"
                                            class="modern-checkbox"
                                        >
                                        <div class="ingredient-status-badge" 
                                             :class="{
                                                 'status-expiring': ingredient.isExpiring,
                                                 'status-available': ingredient.available && !ingredient.isExpiring,
                                                 'status-missing': !ingredient.available
                                             }">
                                            <span class="status-icon">
                                                {{ ingredient.isExpiring ? '⏰' : 
                                                   ingredient.available ? '✓' : '✗' }}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <!-- Center: Ingredient Details -->
                                    <div class="ingredient-center">
                                        <div class="ingredient-name">{{ ingredient.name }}</div>
                                        <div class="ingredient-measure">{{ ingredient.measure }}</div>
                                    </div>
                                    
                                    <!-- Right: Quantity Edit -->
                                    <div class="ingredient-right" v-if="ingredient.available">
                                        <div class="quantity-editor">
                                            <input 
                                                type="number" 
                                                v-model.number="ingredient.editableQuantity"
                                                :disabled="!ingredient.checked"
                                                class="quantity-input-new"
                                                step="0.01"
                                                min="0"
                                            >
                                            <span class="quantity-unit">{{ ingredient.inventoryUnit }}</span>
                                        </div>
                                        <span v-if="ingredient.unitMatch === 'mismatch'" 
                                              class="warning-badge" 
                                              title="Unit mismatch - please verify">
                                            ⚠️
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="modal-actions-new">
                        <button 
                            class="btn-modern btn-cancel" 
                            @click="cancelUseRecipe"
                            :disabled="usingRecipe"
                        >
                            <span>Cancel</span>
                        </button>
                        <button 
                            class="btn-modern btn-confirm" 
                            @click="confirmUseRecipe"
                            :disabled="usingRecipe"
                        >
                            <span v-if="usingRecipe">
                                <span class="spinner-border spinner-border-sm me-2"></span>
                                Processing...
                            </span>
                            <span v-else>
                                ✓ Confirm & Use Recipe ({{ ingredientsToDeduct.filter(i => i.checked).length }} items)
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

.match-excellent { background: #28a745; }
.match-good { background: #17a2b8; }
.match-fair { background: #ffc107; }
.match-low { background: #dc3545; }

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

/* ========== STYLED RECIPE DETAIL MODAL (OPTION 1) ========== */

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

/* ========== ACTION BUTTONS IN SIDEBAR (OPTION 1) ========== */
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
    width: 30px;
    text-align: center;
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

/* ========== CONFIRMATION MODAL STYLES ========== */

.use-recipe-modal-new {
    max-width: 900px;
    border-radius: 20px;
    overflow: hidden;
}

.recipe-confirmation-layout-new {
    padding: 40px;
}

.confirmation-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 30px;
    margin-bottom: 30px;
    padding-bottom: 25px;
    border-bottom: 3px solid #f0f0f0;
}

.confirmation-title-section {
    flex: 1;
}

.confirmation-recipe-name {
    font-size: 2em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 15px 0;
    line-height: 1.2;
}

.confirmation-badges {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.confirmation-image-wrapper {
    flex-shrink: 0;
}

.confirmation-recipe-image-small {
    width: 150px;
    height: 150px;
    border-radius: 15px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.match-info-card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 25px;
    margin-bottom: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 25px;
    border-radius: 15px;
    color: white;
}

.match-percentage-new {
    display: flex;
    align-items: center;
    gap: 15px;
}

.match-circle {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid rgba(255, 255, 255, 0.3);
}

.match-number {
    font-size: 1.8em;
    font-weight: 700;
}

.match-label {
    font-size: 1.1em;
    font-weight: 600;
}

.expiring-alert-new {
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(255, 255, 255, 0.15);
    padding: 15px;
    border-radius: 10px;
    backdrop-filter: blur(10px);
}

.expiring-icon-wrapper {
    flex-shrink: 0;
}

.expiring-icon-large {
    font-size: 2.5em;
    display: block;
}

.expiring-content strong {
    display: block;
    font-size: 1.1em;
    margin-bottom: 5px;
}

.expiring-content p {
    font-size: 0.95em;
    opacity: 0.95;
}

.ingredients-section-new {
    margin-bottom: 30px;
}

.section-title-new {
    font-size: 1.5em;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 8px;
}

.section-subtitle {
    color: #7f8c8d;
    font-size: 0.95em;
    margin-bottom: 20px;
}

.ingredients-list-new {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 10px;
}

.ingredients-list-new::-webkit-scrollbar {
    width: 8px;
}

.ingredients-list-new::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.ingredients-list-new::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
}

.ingredients-list-new::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.ingredient-card {
    background: white;
    border-radius: 12px;
    padding: 15px 20px;
    transition: all 0.3s;
    border: 2px solid transparent;
}

.ingredient-expiring-card {
    border-color: #f39c12;
    background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
}

.ingredient-available-card {
    border-color: #27ae60;
    background: linear-gradient(135deg, #e8f8f5 0%, #fff 100%);
}

.ingredient-missing-card {
    border-color: #e74c3c;
    background: linear-gradient(135deg, #fce8e6 0%, #fff 100%);
    opacity: 0.7;
}

.ingredient-unchecked-card {
    opacity: 0.5;
}

.ingredient-card-content {
    display: flex;
    align-items: center;
    gap: 15px;
}

.ingredient-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.modern-checkbox {
    width: 24px;
    height: 24px;
    cursor: pointer;
    accent-color: #667eea;
}

.modern-checkbox:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.ingredient-status-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
    font-weight: bold;
}

.status-expiring {
    background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
    color: white;
}

.status-available {
    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
    color: white;
}

.status-missing {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
}

.ingredient-center {
    flex: 1;
}

.ingredient-name {
    font-size: 1.1em;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 4px;
}

.ingredient-measure {
    font-size: 0.9em;
    color: #7f8c8d;
}

.ingredient-right {
    display: flex;
    align-items: center;
    gap: 10px;
}

.quantity-editor {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8f9fa;
    padding: 8px 12px;
    border-radius: 8px;
}

.quantity-input-new {
    width: 70px;
    padding: 6px 10px;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    text-align: center;
    font-size: 1em;
    font-weight: 600;
    color: #2c3e50;
    transition: all 0.3s;
}

.quantity-input-new:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.quantity-input-new:disabled {
    background: #e9ecef;
    cursor: not-allowed;
    opacity: 0.6;
}

.quantity-unit {
    font-size: 0.9em;
    font-weight: 600;
    color: #7f8c8d;
}

.warning-badge {
    font-size: 1.3em;
}

.modal-actions-new {
    display: flex;
    gap: 15px;
    padding-top: 25px;
    border-top: 3px solid #f0f0f0;
}

.btn-modern {
    flex: 1;
    padding: 16px 30px;
    font-size: 1.1em;
    font-weight: 600;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-modern:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-cancel {
    background: #ecf0f1;
    color: #7f8c8d;
}

.btn-cancel:hover:not(:disabled) {
    background: #bdc3c7;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-confirm {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-confirm:hover:not(:disabled) {
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
    .recipe-confirmation-layout-new {
        padding: 25px;
    }
    
    .confirmation-header {
        flex-direction: column-reverse;
        align-items: center;
        text-align: center;
    }
    
    .confirmation-recipe-name {
        font-size: 1.6em;
    }
    
    .match-info-card {
        grid-template-columns: 1fr;
    }
    
    .modal-actions-new {
        flex-direction: column;
    }
    
    .ingredient-card-content {
        flex-wrap: wrap;
    }
    
    .ingredient-right {
        width: 100%;
        justify-content: flex-start;
        margin-top: 10px;
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