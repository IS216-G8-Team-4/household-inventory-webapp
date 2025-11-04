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
            initialising: true,
            loading: false,
            error: null,
            showHowItWorksModal: false,
            
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
            lastDeduction: null,
            undoTimeRemaining: 15
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
                    sortOrder: isExpiring ? 0 : (isAvailable ? 1 : 2)
                }
            })
            
            return ingredientsWithStatus.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder
                }
                return a.name.localeCompare(b.name)
            })
        },
        
        undoProgressWidth() {
            return (this.undoTimeRemaining / 15) * 100
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

        showEmptyStateHelp() {
            this.showHowItWorksModal = true;
        },

        closeHowItWorksModal() {
            this.showHowItWorksModal = false;
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
                
                return recipeWords.every(word => inventoryWords.includes(word));
            });
        },
        
        isIngredientExpiring(ingredientName) {
            const recipeIngredient = ingredientName.toLowerCase().trim();
            const recipeWords = recipeIngredient.split(/\s+/);
            
            return this.expiringIngredientNames.some(expiring => {
                const expiringWords = expiring.toLowerCase().trim().split(/\s+/);
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
                this.undoTimeRemaining = 15
                
                const countdownInterval = setInterval(() => {
                    this.undoTimeRemaining--
                    if (this.undoTimeRemaining <= 0) {
                        clearInterval(countdownInterval)
                    }
                }, 1000)
                
                if (this.undoTimer) clearTimeout(this.undoTimer)
                this.undoTimer = setTimeout(async () => {
                    clearInterval(countdownInterval)
                    await this.logConsumption()
                    
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
                const batchesToDelete = []
                
                for (const batch of sortedBatches) {
                    if (remainingQuantity <= 0) break
                    
                    const currentQuantity = parseFloat(batch.quantity)
                    
                    if (currentQuantity > 0) {
                        const deductAmount = Math.min(currentQuantity, remainingQuantity)
                        const newQuantity = currentQuantity - deductAmount
                        
                        if (newQuantity <= 0) {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .delete()
                                .eq('id', batch.id)
                            
                            if (error) throw error
                            
                            batchesToDelete.push(batch.id)
                        } else {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .update({ 
                                    quantity: newQuantity,
                                    status: 'active'
                                })
                                .eq('id', batch.id)
                            
                            if (error) throw error
                        }
                        
                        batchUpdates.push({
                            batchId: batch.id,
                            previousQuantity: currentQuantity,
                            deductedAmount: deductAmount,
                            newQuantity: newQuantity,
                            previousStatus: batch.status || 'active',
                            expiryDate: batch.expiry_date,
                            wasDeleted: newQuantity <= 0
                        })
                        
                        remainingQuantity -= deductAmount
                    }
                }
                
                const { data: remainingBatches, error: checkError } = await supabase
                    .from('ingredient_batches')
                    .select('id')
                    .eq('ingredient_id', inventoryItem.id)
                
                if (checkError) throw checkError
                
                if (!remainingBatches || remainingBatches.length === 0) {
                    const { error: deleteError } = await supabase
                        .from('ingredients')
                        .delete()
                        .eq('id', inventoryItem.id)
                    
                    if (deleteError) throw deleteError
                }
                
                return {
                    ingredientId: inventoryItem.id,
                    ingredientName: inventoryItem.name,
                    totalDeducted: quantityNeeded - remainingQuantity,
                    batchUpdates: batchUpdates,
                    ingredientDeleted: !remainingBatches || remainingBatches.length === 0
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
                    if (deduction.ingredientDeleted) {
                        const ingredientInfo = this.inventory.find(i => i.id === deduction.ingredientId)
                        if (ingredientInfo) {
                            const { error: recreateError } = await supabase
                                .from('ingredients')
                                .insert({
                                    id: deduction.ingredientId,
                                    household_id: this.householdId,
                                    name: ingredientInfo.name,
                                    category: ingredientInfo.category,
                                    unit: ingredientInfo.unit
                                })
                            
                            if (recreateError) throw recreateError
                        }
                    }
                    
                    for (const batchUpdate of deduction.batchUpdates) {
                        if (batchUpdate.wasDeleted) {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .insert({
                                    id: batchUpdate.batchId,
                                    ingredient_id: deduction.ingredientId,
                                    quantity: batchUpdate.previousQuantity,
                                    expiry_date: batchUpdate.expiryDate,
                                    status: batchUpdate.previousStatus
                                })
                            
                            if (error) throw error
                        } else {
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
        },
        
        async logConsumption() {
            if (!this.lastDeduction || !this.householdId) return
            
            try {
                const consumptionLogs = []
                
                for (const deduction of this.lastDeduction.deductions) {
                    let totalQuantityUsed = 0
                    for (const batchUpdate of deduction.batchUpdates) {
                        totalQuantityUsed += batchUpdate.deductedAmount
                    }
                    
                    consumptionLogs.push({
                        ingredient_id: deduction.ingredientId,
                        batch_id: null,
                        user_id: this.householdId,
                        quantity_used: totalQuantityUsed,
                        recipe_name: this.lastDeduction.recipeName,
                        consumed_date: this.lastDeduction.timestamp
                    })
                }
                
                if (consumptionLogs.length > 0) {
                    const { error } = await supabase
                        .from('consumption_logs')
                        .insert(consumptionLogs)
                    
                    if (error) {
                        console.error('Error logging consumption:', error)
                    }
                }
                
            } catch (error) {
                console.error('Error in logConsumption:', error)
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
        this.initialising = true
        await this.fetchSession()
        await this.fetchHouseholdId()
        
        if (this.householdId) {
            await this.fetchInventory()
            await this.fetchExpiringIngredients()
            
            // Only load recipes if inventory is not empty
            if (this.inventory.length > 0) {
                await this.loadRecipes()
            }
        } else {
            console.error('Unable to load recipes: No household ID available')
            this.error = 'Unable to load your household data. Please make sure you have a household set up.'
        }
        this.initialising = false
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
                <div class="expiring-alert-icon">⚠️</div>
                <div class="expiring-alert-content">
                    <strong>{{ expiringIngredients.length }} ingredient(s) expiring soon!</strong>
                    <ul>
                        <li v-for="(item, index) in expiringIngredients" :key="item.id">
                            {{ item.name }}
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Empty State when no inventory -->
        <div v-if="!initialising && !loading && inventory.length === 0" class="empty-state-container">
            <div class="empty-state-card">
                <!-- Illustration/Icon Section -->
                <div class="empty-state-visual">
                    <div class="empty-state-icon-wrapper">
                        <span class="empty-state-icon-large">🥗</span>
                        <span class="empty-state-icon-accent">🍅</span>
                        <span class="empty-state-icon-accent">🥕</span>
                        <span class="empty-state-icon-accent">🧀</span>
                    </div>
                </div>
            
                <!-- Content Section -->
                <div class="empty-state-content">
                    <h2 class="empty-state-title">Your Recipe Journey Starts Here!</h2>
                    <p class="empty-state-description">
                        Add ingredients to your pantry and unlock personalised recipe suggestions 
                        tailored to what you have on hand.
                    </p>
                    
                    <!-- Feature Highlights -->
                    <div class="empty-state-features">
                        <div class="feature-item">
                            <span class="feature-icon">✨</span>
                            <span class="feature-text">Smart Matching</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">⏰</span>
                            <span class="feature-text">Use Expiring Items</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🌍</span>
                            <span class="feature-text">Global Cuisines</span>
                        </div>
                    </div>
                    
                    <!-- Call to Action -->
                    <div class="empty-state-actions">
                        <router-link to="/inventory" class="btn-empty-state btn-primary-empty">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Add Your First Ingredient
                        </router-link>
                        <button class="btn-empty-state btn-secondary-empty" @click="showEmptyStateHelp">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                                <path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            How It Works
                        </button>
                    </div>
                </div>
            
                <!-- Optional: Preview Cards -->
                <div class="empty-state-preview">
                    <p class="preview-label">What you'll get:</p>
                    <div class="preview-cards">
                        <div class="preview-card">
                            <div class="preview-badge">80% Match</div>
                            <div class="preview-image">🍝</div>
                            <p class="preview-title">Recipe Suggestions</p>
                        </div>
                        <div class="preview-card">
                            <div class="preview-badge">⏰ Alert</div>
                            <div class="preview-image">📅</div>
                            <p class="preview-title">Expiry Tracking</p>
                        </div>
                        <div class="preview-card">
                            <div class="preview-badge">Smart Tips</div>
                            <div class="preview-image">💡</div>
                            <p class="preview-title">Reduce Waste</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filters Section (only show if inventory has items) -->
        <div v-if="!initialising && inventory.length > 0" class="filters-section">
            <h3>Filter Recipes</h3>
            
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Search by name</label>
                    <input 
                        type="text" 
                        class="form-control" 
                        v-model="filters.searchQuery"
                        placeholder="e.g., Pasta, Chicken..."
                        aria-label="Search recipes by name"
                    >
                </div>

                <div class="col-md-6">
                    <label class="form-label">Cuisine</label>
                    <select 
                        class="form-select" 
                        v-model="filters.cuisine" 
                        @change="loadRecipes"
                        aria-label="Filter by cuisine"
                    >
                        <option value="">All Cuisines</option>
                        <option v-for="cuisine in cuisines" :key="cuisine" :value="cuisine">
                            {{ cuisine }}
                        </option>
                    </select>
                </div>

                <div class="col-md-6">
                    <label class="form-label">Dietary Preference</label>
                    <select 
                        class="form-select" 
                        v-model="filters.dietaryPreference" 
                        @change="loadRecipes"
                        aria-label="Filter by dietary preference"
                    >
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
                        aria-label="Maximum cooking time in minutes"
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

            <div class="mt-3 filter-actions">
                <button class="btn btn-secondary" @click="clearFilters">Clear Filters</button>
                <button class="btn btn-primary ms-2" @click="loadRecipes">Refresh Recipes</button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="initialising || loading" class="text-center my-5">
            <RecipeLoadingSkeleton v-if="loading" :skeleton-count="6" />
        </div>

        <!-- Error State -->
        <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
        </div>

        <!-- Recipes Grid (only show if inventory has items) -->
        <div v-if="!initialising && !loading && !error && inventory.length > 0" class="recipes-grid">
            <div 
                v-for="recipe in filteredRecipes" 
                :key="recipe.idMeal"
                class="recipe-card"
                @click="showRecipeDetails(recipe)"
                @keypress.enter="showRecipeDetails(recipe)"
                role="button"
                tabindex="0"
                :aria-label="`View details for ${recipe.strMeal}`"
            >
                <div class="recipe-image-container">
                    <img 
                        :src="recipe.strMealThumb" 
                        :alt="recipe.strMeal" 
                        class="recipe-image"
                        loading="lazy"
                    >
                    
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
            <div v-if="filteredRecipes.length === 0" class="col-12 text-center my-5 no-results">
                <div class="no-results-icon">🔍</div>
                <p class="text-muted">No recipes found matching your criteria.</p>
                <button class="btn btn-primary" @click="clearFilters">Clear Filters</button>
            </div>
        </div>

        <!-- RECIPE DETAIL MODAL -->
        <div 
            v-if="selectedRecipe" 
            class="recipe-modal" 
            @click.self="closeRecipeModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-modal-title"
        >
            <div class="recipe-modal-content recipe-detail-modal-styled">
                <button 
                    class="btn-close-modal" 
                    @click="closeRecipeModal"
                    aria-label="Close recipe details"
                >
                    &times;
                </button>
                
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
                               class="btn btn-danger btn-sidebar"
                               rel="noopener noreferrer"
                            >
                                <svg class="youtube-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                            <h2 class="recipe-modal-title" id="recipe-modal-title">{{ selectedRecipe.strMeal }}</h2>
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
                                    <span class="ingredient-check-icon" aria-hidden="true">
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
        <div 
            v-if="showUseRecipeConfirmation" 
            class="recipe-modal" 
            @click.self="cancelUseRecipe"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div class="recipe-modal-content use-recipe-modal-new">
                <button 
                    class="btn-close-modal" 
                    @click="cancelUseRecipe"
                    aria-label="Cancel and close"
                >
                    &times;
                </button>
                
                <div v-if="recipeToUse" class="recipe-confirmation-layout-new">
                    <!-- Header Section -->
                    <div class="confirmation-header-new">
                        <div class="confirmation-image-left">
                            <img 
                                :src="recipeToUse.strMealThumb" 
                                :alt="recipeToUse.strMeal" 
                                class="confirmation-recipe-image-redesign"
                            >
                        </div>
                        <div class="confirmation-info-right">
                            <div class="confirmation-badges-top">
                                <span class="badge bg-secondary">{{ recipeToUse.strCategory }}</span>
                                <span class="badge bg-info">{{ recipeToUse.strArea }}</span>
                            </div>
                            <h2 class="confirmation-recipe-name-new" id="confirm-modal-title">{{ recipeToUse.strMeal }}</h2>
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
                                            :aria-label="`Use ${ingredient.name}`"
                                        >
                                        <label :for="'ingredient-' + index" class="checkbox-label"></label>
                                    </div>
                                    
                                    <!-- Status Indicator -->
                                    <div class="ingredient-status-indicator">
                                        <span v-if="ingredient.isExpiring" class="status-badge badge-expiring" aria-label="Expiring soon">
                                            <span class="icon">⏰</span>
                                        </span>
                                        <span v-else-if="ingredient.available" class="status-badge badge-available" aria-label="Available">
                                            <span class="icon">✓</span>
                                        </span>
                                        <span v-else class="status-badge badge-missing" aria-label="Not available">
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
                                            :aria-label="`Quantity of ${ingredient.name} to use`"
                                        >
                                        <span class="quantity-unit-redesign">{{ ingredient.inventoryUnit }}</span>
                                        <span v-if="ingredient.unitMatch === 'mismatch'" 
                                              class="unit-warning" 
                                              title="Unit mismatch - please verify"
                                              role="img"
                                              aria-label="Warning: unit mismatch">
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
                                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
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

        <!-- HOW IT WORKS MODAL -->
        <div 
            v-if="showHowItWorksModal" 
            class="recipe-modal" 
            @click.self="closeHowItWorksModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
        >
            <div class="recipe-modal-content how-it-works-modal">
                <button 
                    class="btn-close-modal" 
                    @click="closeHowItWorksModal"
                    aria-label="Close how it works guide"
                >
                    &times;
                </button>
                
                <div class="how-it-works-content">
                    <!-- Header -->
                    <div class="how-it-works-header">
                        <div class="how-it-works-icon-badge">
                            <span class="badge-icon">✨</span>
                        </div>
                        <h2 id="how-it-works-title" class="how-it-works-title">How Recipe Suggestions Work</h2>
                        <p class="how-it-works-subtitle">Get personalised recipes based on your pantry</p>
                    </div>
                    
                    <!-- Steps -->
                    <div class="how-it-works-steps">
                        <div class="step-card">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <div class="step-icon">🥬</div>
                                <h3 class="step-title">Add Your Ingredients</h3>
                                <p class="step-description">
                                    Start by adding ingredients from your pantry to your inventory. 
                                    Include expiry dates to track freshness.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <div class="step-icon">🔍</div>
                                <h3 class="step-title">Smart Matching</h3>
                                <p class="step-description">
                                    Our system analyses your inventory and finds recipes that match 
                                    your available ingredients.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <div class="step-icon">⏰</div>
                                <h3 class="step-title">Prioritise Expiring Items</h3>
                                <p class="step-description">
                                    Recipes using ingredients expiring soon are highlighted, 
                                    helping you reduce food waste.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">4</div>
                            <div class="step-content">
                                <div class="step-icon">🍳</div>
                                <h3 class="step-title">Cook & Track</h3>
                                <p class="step-description">
                                    Select a recipe to cook, and we'll automatically deduct 
                                    used ingredients from your inventory.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Features -->
                    <div class="how-it-works-features">
                        <h3 class="features-title">What You Get:</h3>
                        <div class="features-grid">
                            <div class="feature-box">
                                <span class="feature-box-icon">📊</span>
                                <span class="feature-box-text">Match percentage for each recipe</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">🌍</span>
                                <span class="feature-box-text">Recipes from global cuisines</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">🎯</span>
                                <span class="feature-box-text">Filter by cuisine & dietary needs</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">📹</span>
                                <span class="feature-box-text">Video tutorials included</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">♻️</span>
                                <span class="feature-box-text">Reduce food waste</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">💡</span>
                                <span class="feature-box-text">See missing ingredients</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Call to Action -->
                    <div class="how-it-works-footer">
                        <router-link to="/inventory" class="btn-modal-cta" @click="closeHowItWorksModal">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Start Adding Ingredients
                        </router-link>
                    </div>
                </div>
            </div>
        </div>

        <!-- IMPROVED UNDO NOTIFICATION TOAST -->
        <div 
            v-if="showUndoNotification" 
            class="undo-toast-improved"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
        >
            <div class="undo-toast-card">
                <!-- Progress Bar -->
                <div class="undo-progress-bar">
                    <div 
                        class="undo-progress-fill" 
                        :style="{ width: undoProgressWidth + '%' }"
                    ></div>
                </div>
                
                <!-- Content -->
                <div class="undo-content-wrapper">
                    <!-- Icon and Message -->
                    <div class="undo-message-section">
                        <div class="undo-icon-circle">
                            <svg class="checkmark-icon" viewBox="0 0 52 52" aria-hidden="true">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                            </svg>
                        </div>
                        <div class="undo-text-content">
                            <h4 class="undo-title">Recipe Used Successfully!</h4>
                            <p class="undo-subtitle" v-if="lastDeduction">
                                {{ lastDeduction.recipeName }}
                            </p>
                            <p class="undo-timer">
                                <svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Undo available for {{ undoTimeRemaining }}s
                            </p>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="undo-actions-section">
                        <button 
                            class="undo-btn undo-btn-primary" 
                            @click="undoRecipeUse"
                            aria-label="Undo recipe use"
                        >
                            <svg class="undo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                <path d="M3 7v6h6"></path>
                                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
                            </svg>
                            Undo Recipe Use
                        </button>
                        <button 
                            class="undo-btn undo-btn-dismiss" 
                            @click="dismissUndo"
                            aria-label="Dismiss notification"
                        >
                            <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
/* ===== BASE STYLES ===== */
.recipes-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.recipes-header {
    text-align: center;
    margin-bottom: 30px;
}

.recipes-header h1 {
    font-size: 2.5em;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 10px;
}

.subtitle {
    color: #6c757d;
    font-size: 1.1em;
}

/* ===== EXPIRING ALERT ===== */
.expiring-alert {
    background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%);
    border: 2px solid #ffc107;
    border-radius: 12px;
    padding: 20px;
    margin-top: 20px;
    color: #856404;
    display: flex;
    gap: 15px;
    align-items: flex-start;
    box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);
}

.expiring-alert-icon {
    font-size: 2em;
    flex-shrink: 0;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.expiring-alert-content {
    flex: 1;
}

.expiring-alert ul {
    margin: 10px 0 0 0;
    padding-left: 20px;
}

.expiring-alert li {
    margin: 5px 0;
}

/* ===== FILTERS SECTION ===== */
.filters-section {
    background: #f8f9fa;
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 30px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.filters-section h3 {
    margin-bottom: 20px;
    color: #2c3e50;
    font-weight: 600;
}

.filter-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* ===== RECIPES GRID ===== */
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
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
}

.recipe-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.recipe-card:focus {
    outline: 3px solid #4CAF50;
    outline-offset: 2px;
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
    transition: transform 0.3s ease;
}

.recipe-card:hover .recipe-image {
    transform: scale(1.05);
}

.match-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 8px 14px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 0.9em;
    color: white;
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.expiring-badge {
    position: absolute;
    top: 50px;
    right: 12px;
    background: #ff6b6b;
    color: white;
    padding: 6px 12px;
    border-radius: 15px;
    font-size: 0.75em;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.match-badge.match-excellent { background: rgba(40, 167, 69, 0.95); }
.match-badge.match-good { background: rgba(23, 162, 184, 0.95); }
.match-badge.match-fair { background: rgba(255, 193, 7, 0.95); }
.match-badge.match-low { background: rgba(220, 53, 69, 0.95); }

.recipe-content {
    padding: 20px;
}

.recipe-title {
    font-size: 1.2em;
    margin-bottom: 12px;
    color: #2c3e50;
    min-height: 50px;
    font-weight: 600;
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
    padding: 10px;
    border-radius: 6px;
    margin-top: 10px;
    color: #856404;
}

.missing-ingredients {
    margin-top: 10px;
}

/* ===== NO RESULTS ===== */
.no-results {
    padding: 60px 20px;
}

.no-results-icon {
    font-size: 4em;
    margin-bottom: 20px;
    opacity: 0.5;
}

/* ===== MODAL BASE STYLES ===== */
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
    backdrop-filter: blur(5px);
}

.recipe-modal-content {
    background: white;
    border-radius: 16px;
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-30px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
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
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.btn-close-modal:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1) rotate(90deg);
}

/* ===== RECIPE DETAIL MODAL ===== */
.recipe-detail-modal-styled {
    max-width: 1000px;
    padding: 0;
    border-radius: 15px;
    overflow: hidden;
}

.recipe-detail-left .btn-sidebar {
    max-width: none !important;
    flex-grow: 1 !important;
}

.recipe-detail-layout-styled {
    display: grid;
    grid-template-columns: 350px 1fr;
    min-height: 700px;
}

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
}

.detail-recipe-image-styled {
    width: 100%;
    height: 250px;
    object-fit: cover;
    display: block;
}

.match-card {
    background: linear-gradient(135deg, #ff9a56 0%, #ff6a6a 100%);
    padding: 20px;
    border-radius: 12px;
    color: white;
    text-align: center;
    box-shadow: 0 4px 12px rgba(255, 154, 86, 0.3);
}

.match-card.match-excellent {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.match-card.match-good {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.match-card.match-fair {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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

.expiring-card {
    background: white;
    border: 2px solid #ff6b6b;
    padding: 15px;
    border-radius: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.expiring-icon {
    font-size: 1.8em;
    flex-shrink: 0;
}

.expiring-text {
    flex: 1;
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
}

.recipe-modal-actions-sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
}

.btn-sidebar.btn-danger {
    background: #e52d27;
    color: white;
}

.btn-sidebar.btn-danger:hover {
    background: #c9221c;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(229, 45, 39, 0.4);
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
    transition: all 0.2s ease;
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

.instructions-styled {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    line-height: 1.8;
    color: #555;
    white-space: pre-wrap;
    font-size: 0.95em;
}

/* ===== CONFIRMATION MODAL ===== */
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
    overflow: hidden;
}

.confirmation-header-new {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 30px;
    padding: 30px;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border-bottom: 1px solid #e9ecef;
    flex-shrink: 0;
}

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
}

.stat-label {
    font-size: 0.65em;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
}

.stat-divider {
    width: 1px;
    background: #dee2e6;
    align-self: stretch;
}

.stat-value.match-excellent { color: #28a745; }
.stat-value.match-good { color: #17a2b8; }
.stat-value.match-fair { color: #ffc107; }
.stat-value.match-low { color: #dc3545; }
.stat-value.expiring-stat { color: #ff6b6b; }

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
}

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
    transition: all 0.2s ease;
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

.custom-checkbox:focus + .checkbox-label {
    outline: 2px solid #4CAF50;
    outline-offset: 2px;
}

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
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
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

.btn-cancel-redesign:focus {
    outline: 2px solid #6c757d;
    outline-offset: 2px;
}

.btn-confirm-redesign {
    background: #4CAF50;
    color: white;
}

.btn-confirm-redesign:hover:not(:disabled) {
    background: #45a049;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-confirm-redesign:focus {
    outline: 2px solid #4CAF50;
    outline-offset: 2px;
}

.btn-icon {
    font-size: 1.1em;
}

/* ===== IMPROVED UNDO TOAST ===== */
.undo-toast-improved {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 2000;
    max-width: 450px;
    width: calc(100% - 60px);
    animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes slideInRight {
    from {
        transform: translateX(120%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.undo-toast-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    border: 1px solid #e9ecef;
}

/* Progress Bar */
.undo-progress-bar {
    height: 4px;
    background: #e9ecef;
    overflow: hidden;
}

.undo-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%);
    transition: width 1s linear;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

/* Content */
.undo-content-wrapper {
    padding: 20px;
}

.undo-message-section {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 16px;
}

.undo-icon-circle {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.checkmark-icon {
    width: 28px;
    height: 28px;
    stroke-width: 3;
}

.checkmark-circle {
    stroke: white;
    stroke-width: 3;
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
    stroke: white;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}

@keyframes stroke {
    to {
        stroke-dashoffset: 0;
    }
}

.undo-text-content {
    flex: 1;
    min-width: 0;
}

.undo-title {
    font-size: 1.1em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 4px 0;
}

.undo-subtitle {
    font-size: 0.9em;
    color: #6c757d;
    margin: 0 0 8px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.undo-timer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85em;
    color: #4CAF50;
    font-weight: 600;
    margin: 0;
}

.clock-icon {
    width: 16px;
    height: 16px;
    stroke-width: 2;
}

/* Actions */
.undo-actions-section {
    display: flex;
    gap: 10px;
}

.undo-btn {
    padding: 12px 20px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.95em;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.undo-btn-primary {
    flex: 1;
    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.undo-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.undo-btn-primary:active {
    transform: translateY(0);
}

.undo-btn-primary:focus {
    outline: 3px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
}

.undo-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
}

.undo-btn-dismiss {
    width: 44px;
    height: 44px;
    padding: 0;
    background: #f8f9fa;
    color: #6c757d;
}

.undo-btn-dismiss:hover {
    background: #e9ecef;
    color: #2c3e50;
}

.undo-btn-dismiss:focus {
    outline: 2px solid #6c757d;
    outline-offset: 2px;
}

.close-icon {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
}

/* ===== ENHANCED EMPTY STATE ===== */
.empty-state-container {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
}

.empty-state-card {
    max-width: 800px;
    width: 100%;
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
    padding: 50px 40px;
    text-align: center;
    animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Visual Section */
.empty-state-visual {
    margin-bottom: 30px;
    position: relative;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-state-icon-wrapper {
    position: relative;
    display: inline-block;
}

.empty-state-icon-large {
    font-size: 120px;
    display: block;
    animation: float 3s ease-in-out infinite;
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.1));
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
}

.empty-state-icon-accent {
    position: absolute;
    font-size: 40px;
    animation: orbit 4s linear infinite;
}

.empty-state-icon-accent:nth-child(2) {
    animation-delay: 0s;
}

.empty-state-icon-accent:nth-child(3) {
    animation-delay: 1.3s;
}

.empty-state-icon-accent:nth-child(4) {
    animation-delay: 2.6s;
}

@keyframes orbit {
    0% {
        transform: rotate(0deg) translateX(80px) rotate(0deg);
        opacity: 0;
    }
    10% {
        opacity: 1;
    }
    90% {
        opacity: 1;
    }
    100% {
        transform: rotate(360deg) translateX(80px) rotate(-360deg);
        opacity: 0;
    }
}

/* Content Section */
.empty-state-content {
    margin-bottom: 40px;
}

.empty-state-title {
    font-size: 2.2em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 15px 0;
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.empty-state-description {
    font-size: 1.1em;
    color: #6c757d;
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto 30px;
}

/* Feature Highlights */
.empty-state-features {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
    margin: 30px 0;
}

.feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: #f8f9fa;
    border-radius: 25px;
    transition: all 0.3s ease;
}

.feature-item:hover {
    background: #e9ecef;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-icon {
    font-size: 1.5em;
}

.feature-text {
    font-size: 0.95em;
    font-weight: 600;
    color: #2c3e50;
}

/* Call to Action Buttons */
.empty-state-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 30px;
}

.btn-empty-state {
    padding: 16px 32px;
    border-radius: 12px;
    font-size: 1.05em;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-primary-empty {
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
}

.btn-primary-empty:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-secondary-empty {
    background: white;
    color: #4CAF50;
    border: 2px solid #4CAF50;
}

.btn-secondary-empty:hover {
    background: #f8f9fa;
    transform: translateY(-2px);
}

.btn-icon-left {
    width: 20px;
    height: 20px;
    stroke-width: 2;
}

/* Preview Section */
.empty-state-preview {
    margin-top: 50px;
    padding-top: 40px;
    border-top: 2px dashed #e9ecef;
}

.preview-label {
    font-size: 0.9em;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: 20px;
}

.preview-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    max-width: 600px;
    margin: 0 auto;
}

.preview-card {
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    padding: 24px;
    border-radius: 12px;
    border: 2px solid #e9ecef;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.preview-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #4CAF50 0%, #45a049 100%);
    transform: scaleX(0);
    transition: transform 0.3s ease;
}

.preview-card:hover {
    border-color: #4CAF50;
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.preview-card:hover::before {
    transform: scaleX(1);
}

.preview-badge {
    display: inline-block;
    padding: 4px 12px;
    background: #e9ecef;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 600;
    color: #6c757d;
    margin-bottom: 12px;
}

.preview-image {
    font-size: 3em;
    margin: 15px 0;
}

.preview-title {
    font-size: 0.95em;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
}

/* ===== HOW IT WORKS MODAL ===== */
.how-it-works-modal {
    max-width: 900px;
    padding: 0;
    animation: modalSlideIn 0.3s ease-out;
}

.how-it-works-content {
    padding: 40px;
}

/* Header */
.how-it-works-header {
    text-align: center;
    margin-bottom: 40px;
}

.how-it-works-icon-badge {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 8px 24px rgba(76, 175, 80, 0.3);
    animation: pulse 2s ease-in-out infinite;
}

.badge-icon {
    font-size: 2.5em;
}

.how-it-works-title {
    font-size: 2em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 10px 0;
}

.how-it-works-subtitle {
    font-size: 1.1em;
    color: #6c757d;
    margin: 0;
}

/* Steps */
.how-it-works-steps {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 40px;
    overflow-x: auto;
    padding: 20px 0;
}

.step-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 16px;
    padding: 24px;
    min-width: 180px;
    flex: 1;
    position: relative;
    transition: all 0.3s ease;
}

.step-card:hover {
    border-color: #4CAF50;
    box-shadow: 0 8px 24px rgba(76, 175, 80, 0.15);
    transform: translateY(-4px);
}

.step-number {
    position: absolute;
    top: -12px;
    left: 20px;
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9em;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.step-content {
    text-align: center;
}

.step-icon {
    font-size: 2.5em;
    margin-bottom: 12px;
    display: block;
}

.step-title {
    font-size: 1.1em;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 8px 0;
}

.step-description {
    font-size: 0.9em;
    color: #6c757d;
    line-height: 1.5;
    margin: 0;
}

.step-arrow {
    font-size: 2em;
    color: #4CAF50;
    flex-shrink: 0;
    animation: arrowBounce 1.5s ease-in-out infinite;
}

@keyframes arrowBounce {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(5px); }
}

/* Features Section */
.how-it-works-features {
    background: #f8f9fa;
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 30px;
}

.features-title {
    font-size: 1.3em;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 20px 0;
    text-align: center;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
}

.feature-box {
    background: white;
    padding: 16px 20px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.feature-box:hover {
    border-color: #4CAF50;
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
}

.feature-box-icon {
    font-size: 1.8em;
    flex-shrink: 0;
}

.feature-box-text {
    font-size: 0.95em;
    color: #2c3e50;
    font-weight: 500;
}

/* Footer */
.how-it-works-footer {
    text-align: center;
}

.btn-modal-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 16px 32px;
    background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-modal-cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-modal-cta:focus {
    outline: 3px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 1024px) {
    .recipe-detail-layout-styled {
        grid-template-columns: 1fr;
    }
    
    .recipe-detail-left {
        padding: 20px;
    }
    
    .recipe-scrollable-content {
        max-height: none;
        min-height: auto;
    }
}

@media (max-width: 768px) {
    .recipes-container {
        padding: 15px;
    }
    
    .recipes-header h1 {
        font-size: 2em;
    }
    
    .recipes-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .filters-section {
        padding: 20px;
    }
    
    .filter-actions {
        flex-direction: column;
    }
    
    .filter-actions button {
        width: 100%;
    }
    
    .confirmation-header-new {
        grid-template-columns: 1fr;
        gap: 20px;
        padding: 20px;
        text-align: center;
    }
    
    .confirmation-recipe-image-redesign {
        max-width: 250px;
        margin: 0 auto;
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
    
    /* Undo toast mobile */
    .undo-toast-improved {
        bottom: 20px;
        right: 20px;
        left: 20px;
        max-width: none;
        width: auto;
    }
    
    .undo-message-section {
        margin-bottom: 12px;
    }
    
    .undo-actions-section {
        flex-direction: column;
    }
    
    .undo-btn-dismiss {
        width: 100%;
        height: 44px;
    }

    /* Empty state responsive */
    .empty-state-card {
        padding: 40px 25px;
    }
    
    .empty-state-title {
        font-size: 1.8em;
    }
    
    .empty-state-description {
        font-size: 1em;
    }
    
    .empty-state-icon-large {
        font-size: 90px;
    }
    
    .empty-state-features {
        gap: 15px;
    }
    
    .feature-item {
        padding: 10px 16px;
    }
    
    .empty-state-actions {
        flex-direction: column;
    }
    
    .btn-empty-state {
        width: 100%;
        justify-content: center;
    }
    
    .preview-cards {
        grid-template-columns: 1fr;
        gap: 15px;
    }

    /* How it works modal responsive */
    .how-it-works-content {
        padding: 30px 20px;
    }
    
    .how-it-works-title {
        font-size: 1.6em;
    }
    
    .how-it-works-steps {
        flex-direction: column;
        gap: 20px;
    }
    
    .step-arrow {
        transform: rotate(90deg);
        margin: -10px 0;
    }
    
    @keyframes arrowBounce {
        0%, 100% { transform: rotate(90deg) translateX(0); }
        50% { transform: rotate(90deg) translateX(5px); }
    }
    
    .step-card {
        min-width: 100%;
    }
    
    .features-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 480px) {
    .recipes-header h1 {
        font-size: 1.75em;
    }
    
    .expiring-alert {
        flex-direction: column;
        text-align: center;
    }
    
    .recipe-content {
        padding: 15px;
    }
    
    .recipe-title {
        font-size: 1.1em;
        min-height: auto;
    }
    
    .btn-close-modal {
        width: 36px;
        height: 36px;
        font-size: 20px;
    }
    
    .recipe-modal {
        padding: 10px;
    }
    
    .undo-content-wrapper {
        padding: 16px;
    }
    
    .undo-title {
        font-size: 1em;
    }
    
    .undo-btn-primary {
        font-size: 0.9em;
        padding: 10px 16px;
    }

    /* Empty state mobile */
    .empty-state-container {
        padding: 20px 15px;
    }
    
    .empty-state-card {
        padding: 30px 20px;
    }
    
    .empty-state-title {
        font-size: 1.5em;
    }
    
    .empty-state-visual {
        height: 140px;
    }
    
    .empty-state-icon-large {
        font-size: 70px;
    }
    
    .empty-state-icon-accent {
        font-size: 30px;
    }
    
    @keyframes orbit {
        0%, 100% {
            transform: rotate(0deg) translateX(60px) rotate(0deg);
            opacity: 0;
        }
        10%, 90% {
            opacity: 1;
        }
    }

    /* How it works modal mobile */
    .how-it-works-content {
        padding: 25px 15px;
    }
    
    .how-it-works-icon-badge {
        width: 60px;
        height: 60px;
    }
    
    .badge-icon {
        font-size: 2em;
    }
    
    .how-it-works-title {
        font-size: 1.4em;
    }
    
    .step-icon {
        font-size: 2em;
    }
    
    .btn-modal-cta {
        width: 100%;
        justify-content: center;
    }
}

/* ===== ACCESSIBILITY ===== */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Focus visible for keyboard navigation */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
    outline: 3px solid #4CAF50;
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .recipe-card {
        border: 2px solid currentColor;
    }
    
    .btn-sidebar,
    .undo-btn {
        border: 2px solid currentColor;
    }
}

/* Focus States for Accessibility */
.btn-empty-state:focus-visible {
    outline: 3px solid #4CAF50;
    outline-offset: 3px;
}

/* Accessibility - Reduced Motion */
@media (prefers-reduced-motion: reduce) {
    .empty-state-icon-large,
    .empty-state-icon-accent,
    .empty-state-card,
    .how-it-works-icon-badge,
    .step-arrow {
        animation: none !important;
    }
    
    .preview-card::before {
        transition: none;
    }
}
</style>